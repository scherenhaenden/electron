const path = require('path')
const fs = require('fs')
const semver = require('semver')
const { getLastMajorForMaster } = require('../get-last-major-for-master')
const { GitProcess } = require('dugite')
const { promisify } = require('util')

const readFile = promisify(fs.readFile)
const gitDir = path.resolve(__dirname, '..', '..')

const getCurrentDate = () => {
  const d = new Date()
  const dd = `${d.getDate()}`.padStart(2, '0')
  const mm = `${d.getMonth() + 1}`.padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${yyyy}${mm}${dd}`
}

const isNightly = v => v.includes('nightly')
const isBeta = v => v.includes('beta')
const isStable = v => {
  v = semver.clean(v)
  const validFormat = semver.valid(semver.coerce(v))
  return validFormat ? (validFormat && v.split('.').length === 3) : false
}

async function nextBeta (v) {
  const next = semver.coerce(semver.clean(v))

  const tagBlob = await GitProcess.exec(['tag', '--list', '-l', `v${next}-beta.*`], gitDir)
  const tags = tagBlob.stdout.split('\n').filter(e => e !== '')
  tags.sort((t1, t2) => semver.gt(t1, t2))

  return tags.length === 0 ? semver.inc(next, 'beta', 'prerelease') : semver.inc(tags.pop(), 'prerelease')
}

async function getElectronVersion () {
  const versionPath = path.join(__dirname, '..', '..', 'VERSION')
  const version = await readFile(versionPath, 'utf8')
  return version.trim()
}

async function nextNightly (v) {
  let next = semver.valid(semver.coerce(v))
  const pre = `nightly.${getCurrentDate()}`

  if (isStable(v)) next = semver.inc(next, 'patch')
  const branch = await GitProcess.exec(['rev-parse', '--abbrev-ref', 'HEAD'], gitDir)
  if (branch === 'master') {
    next = semver.inc(await getLastMajorForMaster(), 'major')
  }

  return `${next}-${pre}`
}

module.exports = {
  isStable,
  isBeta,
  isNightly,
  nextBeta,
  getElectronVersion,
  nextNightly
}
