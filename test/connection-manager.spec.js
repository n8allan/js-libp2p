/* eslint-env mocha */
'use strict'

const chai = require('chai')
chai.use(require('dirty-chai'))
const Prepare = require('./utils/prepare')

describe('connection manager', function () {
  const prepare = Prepare(3)
  before(prepare.before)
  after(prepare.after)

  it('works', (done) => {
    prepare.connManagers().forEach((connManager) => {
      connManager.on('disconnected', () => {
        throw new Error('should not have disconnected')
      })
    })
    setTimeout(done, 1900)
  })
})