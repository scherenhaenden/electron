const { expect } = require('chai')
const { nextVersion } = require('../script/bump-version')

describe('bump-version script', () => {
  const nightlyPattern = /[0-9.]*(-nightly.(\d{4})(\d{2})(\d{2}))$/g
  const betaPattern = /[0-9.]*(-beta[0-9.]*)/g

  it('bumps to nightly from stable', async () => {
    const version = 'v2.0.0'
    const next = await nextVersion('nightly', version)
    const matches = next.match(nightlyPattern)
    expect(matches).to.have.lengthOf(1)
  })

  it('bumps to nightly from beta', async () => {
    const version = 'v2.0.0-beta.1'
    const next = await nextVersion('nightly', version)
    const matches = next.match(nightlyPattern)
    expect(matches).to.have.lengthOf(1)
  })

  it('bumps to nightly from nightly', async () => {
    const version = 'v2.0.0-nightly.19950901'
    const next = await nextVersion('nightly', version)
    const matches = next.match(nightlyPattern)
    expect(matches).to.have.lengthOf(1)
  })

  it('errors when bumping to beta from stable', () => {
    const version = 'v2.0.0'
    return expect(
      nextVersion('beta', version)
    ).to.be.rejectedWith('Cannot bump to beta from stable.')
  })

  it('bumps to beta from nightly', async () => {
    const version = 'v2.0.0-nightly.19950901'
    const next = await nextVersion('beta', version)
    const matches = next.match(betaPattern)
    expect(matches).to.have.lengthOf(1)
  })

  it('bumps to beta from beta', async () => {
    const version = 'v2.0.0-beta.1'
    const next = await nextVersion('beta', version)
    const matches = next.match(betaPattern)
    expect(matches).to.have.lengthOf(1)
  })

  it('bumps to stable from beta', async () => {
    const version = 'v2.0.0-beta.1'
    const next = await nextVersion('stable', version)
    expect(next).to.equal('2.0.0')
  })

  it('bumps to stable from stable', async () => {
    const version = 'v2.0.0'
    const next = await nextVersion('stable', version)
    expect(next).to.equal('2.0.1')
  })

  it('bumps to stable from nightly', async () => {
    const version = 'v2.0.0-nightly.19950901'
    const next = await nextVersion('stable', version)
    expect(next).to.equal('2.0.0')
  })
})
