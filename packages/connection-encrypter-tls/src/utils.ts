import { Duplex as DuplexStream } from 'node:stream'
import { Ed25519PublicKey, Secp256k1PublicKey, marshalPublicKey, supportedKeys, unmarshalPrivateKey, unmarshalPublicKey } from '@libp2p/crypto/keys'
import { CodeError, InvalidCryptoExchangeError, UnexpectedPeerError } from '@libp2p/interface'
import { peerIdFromKeys } from '@libp2p/peer-id'
import { AsnConvert } from '@peculiar/asn1-schema'
import * as asn1X509 from '@peculiar/asn1-x509'
import { Crypto } from '@peculiar/webcrypto'
import * as x509 from '@peculiar/x509'
import * as asn1js from 'asn1js'
import { pushable } from 'it-pushable'
import { concat as uint8ArrayConcat } from 'uint8arrays/concat'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { KeyType, PublicKey } from '../src/pb/index.js'
import type { PeerId, PublicKey as Libp2pPublicKey, Logger } from '@libp2p/interface'
import type { Duplex } from 'it-stream-types'
import type { Uint8ArrayList } from 'uint8arraylist'

const crypto = new Crypto()
x509.cryptoProvider.set(crypto)

const LIBP2P_PUBLIC_KEY_EXTENSION = '1.3.6.1.4.1.53594.1.1'
const CERT_PREFIX = 'libp2p-tls-handshake:'
// https://github.com/libp2p/go-libp2p/blob/28c0f6ab32cd69e4b18e9e4b550ef6ce059a9d1a/p2p/security/tls/crypto.go#L265
const CERT_VALIDITY_PERIOD_FROM = 60 * 60 * 1000 // ~1 hour

// N.b. have to keep expiry date before 2050 - when https://github.com/PeculiarVentures/x509/issues/73
// is fixed we can revert to 100 years
const CERT_VALIDITY_PERIOD_TO = 10 * 365 * 24 * 60 * 60 * 1000 // ~10 years
// https://github.com/libp2p/go-libp2p/blob/28c0f6ab32cd69e4b18e9e4b550ef6ce059a9d1a/p2p/security/tls/crypto.go#L24C28-L24C44
// const CERT_VALIDITY_PERIOD_TO = 100 * 365 * 24 * 60 * 60 * 1000 // ~100 years

export async function verifyPeerCertificate (rawCertificate: Uint8Array, expectedPeerId?: PeerId, log?: Logger): Promise<PeerId> {
  const now = Date.now()
  const x509Cert = new x509.X509Certificate(rawCertificate)

  if (x509Cert.notBefore.getTime() > now) {
    log?.error('the certificate was not valid yet')
    throw new CodeError('The certificate is not valid yet', 'ERR_INVALID_CERTIFICATE')
  }

  if (x509Cert.notAfter.getTime() < now) {
    log?.error('the certificate has expired')
    throw new CodeError('The certificate has expired', 'ERR_INVALID_CERTIFICATE')
  }

  const certSignatureValid = await x509Cert.verify()

  if (!certSignatureValid) {
    log?.error('certificate self signature was invalid')
    throw new InvalidCryptoExchangeError('Invalid certificate self signature')
  }

  const certIsSelfSigned = await x509Cert.isSelfSigned()

  if (!certIsSelfSigned) {
    log?.error('certificate must be self signed')
    throw new InvalidCryptoExchangeError('Certificate must be self signed')
  }

  const libp2pPublicKeyExtension = x509Cert.extensions[0]

  if (libp2pPublicKeyExtension == null || libp2pPublicKeyExtension.type !== LIBP2P_PUBLIC_KEY_EXTENSION) {
    log?.error('the certificate did not include the libp2p public key extension')
    throw new CodeError('The certificate did not include the libp2p public key extension', 'ERR_INVALID_CERTIFICATE')
  }

  const { result: libp2pKeySequence } = asn1js.fromBER(libp2pPublicKeyExtension.value)

  // @ts-expect-error deep chain
  const remotePeerIdPb = libp2pKeySequence.valueBlock.value[0].valueBlock.valueHex
  const marshalledPeerId = new Uint8Array(remotePeerIdPb, 0, remotePeerIdPb.byteLength)
  const remotePublicKey = PublicKey.decode(marshalledPeerId)
  const remotePublicKeyData = remotePublicKey.data ?? new Uint8Array(0)
  let remoteLibp2pPublicKey: Libp2pPublicKey

  if (remotePublicKey.type === KeyType.Ed25519) {
    remoteLibp2pPublicKey = new Ed25519PublicKey(remotePublicKeyData)
  } else if (remotePublicKey.type === KeyType.Secp256k1) {
    remoteLibp2pPublicKey = new Secp256k1PublicKey(remotePublicKeyData)
  } else if (remotePublicKey.type === KeyType.RSA) {
    remoteLibp2pPublicKey = supportedKeys.rsa.unmarshalRsaPublicKey(remotePublicKeyData)
  } else {
    log?.error('unknown or unsupported key type', remotePublicKey.type)
    throw new InvalidCryptoExchangeError('Unknown or unsupported key type')
  }

  // @ts-expect-error deep chain
  const remoteSignature = libp2pKeySequence.valueBlock.value[1].valueBlock.valueHex
  const dataToVerify = encodeSignatureData(x509Cert.publicKey.rawData)
  const result = await remoteLibp2pPublicKey.verify(dataToVerify, new Uint8Array(remoteSignature, 0, remoteSignature.byteLength))

  if (!result) {
    log?.error('invalid libp2p signature')
    throw new InvalidCryptoExchangeError('Could not verify signature')
  }

  const marshalled = marshalPublicKey(remoteLibp2pPublicKey)
  const remotePeerId = await peerIdFromKeys(marshalled)

  if (expectedPeerId?.equals(remotePeerId) === false) {
    log?.error('invalid peer id')
    throw new UnexpectedPeerError()
  }

  return remotePeerId
}

export async function generateCertificate (peerId: PeerId): Promise<{ cert: string, key: string }> {
  const now = Date.now()

  const alg = {
    name: 'ECDSA',
    namedCurve: 'P-256',
    hash: 'SHA-256'
  }

  const keys = await crypto.subtle.generateKey(alg, true, ['sign'])

  const certPublicKeySpki = await crypto.subtle.exportKey('spki', keys.publicKey)
  const dataToSign = encodeSignatureData(certPublicKeySpki)

  if (peerId.privateKey == null) {
    throw new InvalidCryptoExchangeError('Private key was missing from PeerId')
  }

  const privateKey = await unmarshalPrivateKey(peerId.privateKey)
  const sig = await privateKey.sign(dataToSign)

  let keyType: KeyType
  let keyData: Uint8Array

  if (peerId.publicKey == null) {
    throw new CodeError('Public key missing from PeerId', 'ERR_INVALID_PEER_ID')
  }

  const publicKey = unmarshalPublicKey(peerId.publicKey)

  if (peerId.type === 'Ed25519') {
    // Ed25519: Only the 32 bytes of the public key
    keyType = KeyType.Ed25519
    keyData = publicKey.marshal()
  } else if (peerId.type === 'secp256k1') {
    // Secp256k1: Only the compressed form of the public key. 33 bytes.
    keyType = KeyType.Secp256k1
    keyData = publicKey.marshal()
  } else if (peerId.type === 'RSA') {
    // The rest of the keys are encoded as a SubjectPublicKeyInfo structure in PKIX, ASN.1 DER form.
    keyType = KeyType.RSA
    keyData = publicKey.marshal()
  } else {
    throw new CodeError('Unknown PeerId type', 'ERR_UNKNOWN_PEER_ID_TYPE')
  }

  const selfCert = await x509.X509CertificateGenerator.createSelfSigned({
    serialNumber: generateSerialNumber(),
    notBefore: new Date(now - CERT_VALIDITY_PERIOD_FROM),
    notAfter: new Date(now + CERT_VALIDITY_PERIOD_TO),
    signingAlgorithm: alg,
    keys,
    extensions: [
      new x509.Extension(LIBP2P_PUBLIC_KEY_EXTENSION, true, new asn1js.Sequence({
        value: [
          // publicKey
          new asn1js.OctetString({
            valueHex: PublicKey.encode({
              type: keyType,
              data: keyData
            })
          }),
          // signature
          new asn1js.OctetString({
            valueHex: sig
          })
        ]
      }).toBER())
    ]
  })

  const certPrivateKeySpki = await crypto.subtle.exportKey('spki', keys.privateKey)

  return {
    cert: selfCert.toString(),
    key: spkiToPEM(certPrivateKeySpki)
  }
}

function generateSerialNumber (): string {
  // HACK: serial numbers starting with 80 generated by @peculiar/x509 don't
  // work with TLSSocket, remove when https://github.com/PeculiarVentures/x509/issues/74
  // is resolved
  while (true) {
    const serialNumber = (Math.random() * Math.pow(2, 52)).toFixed(0)

    if (!serialNumber.startsWith('80')) {
      return serialNumber
    }
  }
}

/**
 * @see https://github.com/libp2p/specs/blob/master/tls/tls.md#libp2p-public-key-extension
 */
export function encodeSignatureData (certPublicKey: ArrayBuffer): Uint8Array {
  const keyInfo = AsnConvert.parse(certPublicKey, asn1X509.SubjectPublicKeyInfo)
  const bytes = AsnConvert.serialize(keyInfo)

  return uint8ArrayConcat([
    uint8ArrayFromString(CERT_PREFIX),
    new Uint8Array(bytes, 0, bytes.byteLength)
  ])
}

function spkiToPEM (keydata: ArrayBuffer): string {
  return formatAsPem(uint8ArrayToString(new Uint8Array(keydata), 'base64'))
}

function formatAsPem (str: string): string {
  let finalString = '-----BEGIN PRIVATE KEY-----\n'

  while (str.length > 0) {
    finalString += str.substring(0, 64) + '\n'
    str = str.substring(64)
  }

  finalString = finalString + '-----END PRIVATE KEY-----'

  return finalString
}

export function itToStream (conn: Duplex<AsyncGenerator<Uint8Array | Uint8ArrayList>>): DuplexStream {
  const output = pushable()
  const iterator = conn.source[Symbol.asyncIterator]() as AsyncGenerator<Uint8Array>

  const stream = new DuplexStream({
    autoDestroy: false,
    allowHalfOpen: true,
    write (chunk, encoding, callback) {
      output.push(chunk)
      callback()
    },
    read () {
      iterator.next()
        .then(result => {
          if (result.done === true) {
            this.push(null)
          } else {
            this.push(result.value)
          }
        }, (err) => {
          this.destroy(err)
        })
    }
  })

  // @ts-expect-error return type of sink is unknown
  conn.sink(output)
    .catch((err: any) => {
      stream.destroy(err)
    })

  return stream
}

export function streamToIt (stream: DuplexStream): Duplex<AsyncGenerator<Uint8Array | Uint8ArrayList>> {
  const output: Duplex<AsyncGenerator<Uint8Array | Uint8ArrayList>> = {
    source: (async function * () {
      const output = pushable<Uint8Array>()

      stream.addListener('data', (buf) => {
        output.push(buf.subarray())
      })
      // both ends closed
      stream.addListener('close', () => {
        output.end()
      })
      stream.addListener('error', (err) => {
        output.end(err)
      })
      // just writable end closed
      stream.addListener('finish', () => {
        output.end()
      })

      try {
        yield * output
      } catch (err: any) {
        stream.destroy(err)
        throw err
      }
    })(),
    sink: async (source) => {
      try {
        for await (const buf of source) {
          const sendMore = stream.write(buf.subarray())

          if (!sendMore) {
            await waitForBackpressure(stream)
          }
        }

        // close writable end
        stream.end()
      } catch (err: any) {
        stream.destroy(err)
        throw err
      }
    }
  }

  return output
}

async function waitForBackpressure (stream: DuplexStream): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const continueListener = (): void => {
      cleanUp()
      resolve()
    }
    const stopListener = (err?: Error): void => {
      cleanUp()
      reject(err ?? new Error('Stream ended'))
    }

    const cleanUp = (): void => {
      stream.removeListener('drain', continueListener)
      stream.removeListener('end', stopListener)
      stream.removeListener('error', stopListener)
    }

    stream.addListener('drain', continueListener)
    stream.addListener('end', stopListener)
    stream.addListener('error', stopListener)
  })
}
