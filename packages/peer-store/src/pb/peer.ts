/* eslint-disable import/export */
/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-unnecessary-boolean-literal-compare */
/* eslint-disable @typescript-eslint/no-empty-interface */

import { encodeMessage, decodeMessage, message } from 'protons-runtime'
import type { Codec } from 'protons-runtime'
import type { Uint8ArrayList } from 'uint8arraylist'

export interface Peer {
  addresses: Address[]
  protocols: string[]
  publicKey?: Uint8Array
  peerRecordEnvelope?: Uint8Array
  metadata: Map<string, Uint8Array>
  tags: Map<string, Tag>
}

export namespace Peer {
  export interface Peer$metadataEntry {
    key: string
    value: Uint8Array
  }

  export namespace Peer$metadataEntry {
    let _codec: Codec<Peer$metadataEntry>

    export const codec = (): Codec<Peer$metadataEntry> => {
      if (_codec == null) {
        _codec = message<Peer$metadataEntry>((obj, w, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            w.fork()
          }

          if ((obj.key != null && obj.key !== '')) {
            w.uint32(10)
            w.string(obj.key)
          }

          if ((obj.value != null && obj.value.byteLength > 0)) {
            w.uint32(18)
            w.bytes(obj.value)
          }

          if (opts.lengthDelimited !== false) {
            w.ldelim()
          }
        }, (reader, length) => {
          const obj: any = {
            key: '',
            value: new Uint8Array(0)
          }

          const end = length == null ? reader.len : reader.pos + length

          while (reader.pos < end) {
            const tag = reader.uint32()

            switch (tag >>> 3) {
              case 1:
                obj.key = reader.string()
                break
              case 2:
                obj.value = reader.bytes()
                break
              default:
                reader.skipType(tag & 7)
                break
            }
          }

          return obj
        })
      }

      return _codec
    }

    export const encode = (obj: Partial<Peer$metadataEntry>): Uint8Array => {
      return encodeMessage(obj, Peer$metadataEntry.codec())
    }

    export const decode = (buf: Uint8Array | Uint8ArrayList): Peer$metadataEntry => {
      return decodeMessage(buf, Peer$metadataEntry.codec())
    }
  }

  export interface Peer$tagsEntry {
    key: string
    value?: Tag
  }

  export namespace Peer$tagsEntry {
    let _codec: Codec<Peer$tagsEntry>

    export const codec = (): Codec<Peer$tagsEntry> => {
      if (_codec == null) {
        _codec = message<Peer$tagsEntry>((obj, w, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            w.fork()
          }

          if ((obj.key != null && obj.key !== '')) {
            w.uint32(10)
            w.string(obj.key)
          }

          if (obj.value != null) {
            w.uint32(18)
            Tag.codec().encode(obj.value, w)
          }

          if (opts.lengthDelimited !== false) {
            w.ldelim()
          }
        }, (reader, length) => {
          const obj: any = {
            key: ''
          }

          const end = length == null ? reader.len : reader.pos + length

          while (reader.pos < end) {
            const tag = reader.uint32()

            switch (tag >>> 3) {
              case 1:
                obj.key = reader.string()
                break
              case 2:
                obj.value = Tag.codec().decode(reader, reader.uint32())
                break
              default:
                reader.skipType(tag & 7)
                break
            }
          }

          return obj
        })
      }

      return _codec
    }

    export const encode = (obj: Partial<Peer$tagsEntry>): Uint8Array => {
      return encodeMessage(obj, Peer$tagsEntry.codec())
    }

    export const decode = (buf: Uint8Array | Uint8ArrayList): Peer$tagsEntry => {
      return decodeMessage(buf, Peer$tagsEntry.codec())
    }
  }

  let _codec: Codec<Peer>

  export const codec = (): Codec<Peer> => {
    if (_codec == null) {
      _codec = message<Peer>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (obj.addresses != null) {
          for (const value of obj.addresses) {
            w.uint32(10)
            Address.codec().encode(value, w)
          }
        }

        if (obj.protocols != null) {
          for (const value of obj.protocols) {
            w.uint32(18)
            w.string(value)
          }
        }

        if (obj.publicKey != null) {
          w.uint32(34)
          w.bytes(obj.publicKey)
        }

        if (obj.peerRecordEnvelope != null) {
          w.uint32(42)
          w.bytes(obj.peerRecordEnvelope)
        }

        if (obj.metadata != null && obj.metadata.size !== 0) {
          for (const [key, value] of obj.metadata.entries()) {
            w.uint32(50)
            Peer.Peer$metadataEntry.codec().encode({ key, value }, w)
          }
        }

        if (obj.tags != null && obj.tags.size !== 0) {
          for (const [key, value] of obj.tags.entries()) {
            w.uint32(58)
            Peer.Peer$tagsEntry.codec().encode({ key, value }, w)
          }
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {
          addresses: [],
          protocols: [],
          metadata: new Map<string, Uint8Array>(),
          tags: new Map<string, undefined>()
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1:
              obj.addresses.push(Address.codec().decode(reader, reader.uint32()))
              break
            case 2:
              obj.protocols.push(reader.string())
              break
            case 4:
              obj.publicKey = reader.bytes()
              break
            case 5:
              obj.peerRecordEnvelope = reader.bytes()
              break
            case 6: {
              const entry = Peer.Peer$metadataEntry.codec().decode(reader, reader.uint32())
              obj.metadata.set(entry.key, entry.value)
              break
            }
            case 7: {
              const entry = Peer.Peer$tagsEntry.codec().decode(reader, reader.uint32())
              obj.tags.set(entry.key, entry.value)
              break
            }
            default:
              reader.skipType(tag & 7)
              break
          }
        }

        return obj
      })
    }

    return _codec
  }

  export const encode = (obj: Partial<Peer>): Uint8Array => {
    return encodeMessage(obj, Peer.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): Peer => {
    return decodeMessage(buf, Peer.codec())
  }
}

export interface Address {
  multiaddr: Uint8Array
  isCertified?: boolean
  lastSuccess?: bigint
  lastFailure?: bigint
}

export namespace Address {
  let _codec: Codec<Address>

  export const codec = (): Codec<Address> => {
    if (_codec == null) {
      _codec = message<Address>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if ((obj.multiaddr != null && obj.multiaddr.byteLength > 0)) {
          w.uint32(10)
          w.bytes(obj.multiaddr)
        }

        if (obj.isCertified != null) {
          w.uint32(16)
          w.bool(obj.isCertified)
        }

        if (obj.lastSuccess != null) {
          w.uint32(24)
          w.uint64(obj.lastSuccess)
        }

        if (obj.lastFailure != null) {
          w.uint32(32)
          w.uint64(obj.lastFailure)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {
          multiaddr: new Uint8Array(0)
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1:
              obj.multiaddr = reader.bytes()
              break
            case 2:
              obj.isCertified = reader.bool()
              break
            case 3:
              obj.lastSuccess = reader.uint64()
              break
            case 4:
              obj.lastFailure = reader.uint64()
              break
            default:
              reader.skipType(tag & 7)
              break
          }
        }

        return obj
      })
    }

    return _codec
  }

  export const encode = (obj: Partial<Address>): Uint8Array => {
    return encodeMessage(obj, Address.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): Address => {
    return decodeMessage(buf, Address.codec())
  }
}

export interface Tag {
  value: number
  expiry?: bigint
}

export namespace Tag {
  let _codec: Codec<Tag>

  export const codec = (): Codec<Tag> => {
    if (_codec == null) {
      _codec = message<Tag>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if ((obj.value != null && obj.value !== 0)) {
          w.uint32(8)
          w.uint32(obj.value)
        }

        if (obj.expiry != null) {
          w.uint32(16)
          w.uint64(obj.expiry)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {
          value: 0
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1:
              obj.value = reader.uint32()
              break
            case 2:
              obj.expiry = reader.uint64()
              break
            default:
              reader.skipType(tag & 7)
              break
          }
        }

        return obj
      })
    }

    return _codec
  }

  export const encode = (obj: Partial<Tag>): Uint8Array => {
    return encodeMessage(obj, Tag.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): Tag => {
    return decodeMessage(buf, Tag.codec())
  }
}
