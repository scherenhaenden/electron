const path = require('path')
const fs = require('fs')
const { getLastMajorForMaster } = require('../get-last-major-for-master')
const { GitProcess } = require('dugite')
const { promisify } = require('util')

const readFile = promisify(fs.readFile)

const getCurrentDate = () => {
  const d = new Date()
  const dd = d.getDate()
  const mm = d.getMonth() + 1
  const yyyy = d.getFullYear()
  return `${yyyy}${mm}${dd}`
}

function sortBetaTags (tag1, tag2) {
  const beta1 = parseInt(parseVersion(tag1)[3], 10)
  const beta2 = parseInt(parseVersion(tag2)[3], 10)
  return beta1 - beta2
}

const isStable = v => v.split('.').length === 3
const isBeta = v => v.includes('beta')
const isNightly = v => v.includes('nightly')

function parseVersion (version) {
  if (version[0] === 'v') {
    version = version.slice(1)
  }
  const parts = version.split('.')
  const len = parts.length
  return len > 4 ? parts.slice(0, 4) : parts.concat(Array(4 - len).fill('0'))
}

async function nextBeta (v) {
  const pv = parseVersion(v.split('-')[0])
  const tagPattern = `v${pv[0]}.${pv[1]}.${pv[2]}-beta.*`

  const gitDir = path.resolve(__dirname, '..', '..')
  const tagBlob = await GitProcess.exec(['tag', '--list', '-l', tagPattern], gitDir)
  const tags = tagBlob.stdout.split('\n').filter(e => e !== '')
  tags.sort(sortBetaTags)

  if (tags.length === 0) {
    return makeVersion(pv[0], pv[1], pv[2], 'beta.1')
  }

  const next = parseVersion([...tags].pop())
  next[3]++
  return makeVersion(next)
}

async function getElectronVersion () {
  const versionPath = path.join(__dirname, '..', '..', 'VERSION')
  const version = await readFile(versionPath, { encoding: 'utf8' })
  return version
}

async function nextNightly (v) {
  const pv = parseVersion(v.split('-')[0])
  let [major, minor, patch] = pv.slice(0, 3)
  const pre = `nightly.${getCurrentDate()}`
  if (isStable(v)) patch = patch++

  const gitDir = path.resolve(__dirname, '..', '..')
  const branch = await GitProcess.exec(['rev-parse', '--abbrev-ref', 'HEAD'], gitDir)
  if (branch === 'master') {
    [major, minor, patch] = [await getLastMajorForMaster() + 1, '0', '0']
  }

  return makeVersion([major, minor, patch, pre])
}

function nextStableFromPre (v) {
  const pv = parseVersion(v.split('-')[0])
  return makeVersion(pv.slice(0, 3))
}

function nextStableFromStable (v) {
  const pv = parseVersion(v.split('-')[0])
  let [major, minor, patch] = pv.slice(0, 3)
  return makeVersion([major, minor, patch++])
}

function makeVersion (parts) {
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}-${parts[3]}`
  }
  return `${parts[0]}.${parts[1]}.${parts[2]}`
}

module.exports = {
  isStable,
  isBeta,
  isNightly,
  parseVersion,
  nextBeta,
  getElectronVersion,
  nextNightly,
  nextStableFromPre,
  nextStableFromStable,
  makeVersion
}
