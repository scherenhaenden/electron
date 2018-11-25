#!/usr/bin/env node

const { GitProcess } = require('dugite')
const utils = require('./lib/version-utils')
const plist = require('plist')
const fs = require('fs')
const semver = require('semver')
const path = require('path')
const { promisify } = require('util')
const minimist = require('minimist')

const writeFile = promisify(fs.writeFile)
const readFile = promisify(fs.readFile)

function parseCommandLine () {
  let help
  const opts = minimist(process.argv.slice(2), {
    string: [ 'bump', 'version' ],
    boolean: [ 'stable', 'dryRun', 'help' ],
    alias: { 'version': ['v'] },
    unknown: arg => { help = true }
  })
  if (help || opts.help || !(opts.bump || opts.stable)) {
    console.log(`
      Bump release version number. Possible arguments:\n
        --bump=patch to increment patch version\n
        --stable to promote current beta to stable\n
        --version={version} to set version number directly\n
        --dryRun to print the next version without updating files
      Note that you can use both --bump and --stable  simultaneously. 
      Must specify at least one of [--bump | --stable | --version].
    `)
    process.exit(0)
  }
  return opts
}

// run the script
async function main () {
  const opts = parseCommandLine()
  const currentVersion = await utils.getElectronVersion()
  const version = await nextVersion(opts.bump, currentVersion)
  const components = semver.valid(semver.coerce(version)).split('.')

  let pre
  if (version.includes('-')) {
    pre = `-${version.split('-')[1]}`
    components[3] = version.split('-')[1].split('.')[1]
  }

  // print would-be new version and exit early
  if (opts.dryRun) {
    console.log(`new version number would be: ${version}\n`)
    return 0
  }

  // update all version-related files
  await Promise.all([
    updateVersion(version),
    updateInfoPlist(version),
    updatePackageJSON(version),
    tagVersion(version),
    updateVersionH(components, pre),
    updateWinRC(components)
  ])

  console.log(`Bumped to version: ${version}`)
}

// get next version for release based on [nightly, beta, stable]
async function nextVersion (bumpType, version) {
  if (utils.isNightly(version) || utils.isBeta(version)) {
    switch (bumpType) {
      case 'nightly':
        version = await utils.nextNightly(version)
        break
      case 'beta':
        version = await utils.nextBeta(version)
        break
      case 'stable':
        version = semver.valid(semver.coerce(version))
        break
      default:
        throw new Error('Invalid bump type.')
    }
  } else if (utils.isStable(version)) {
    switch (bumpType) {
      case 'nightly':
        version = utils.nextNightly(version)
        break
      case 'beta':
        throw new Error('Cannot bump to beta from stable.')
      case 'stable':
        version = semver.inc(version, 'patch')
        break
      default:
        throw new Error('Invalid bump type.')
    }
  } else {
    throw new Error(`Invalid current version: ${version}`)
  }
  return version
}

// update VERSION file with latest release info
async function updateVersion (version) {
  const versionPath = path.resolve(__dirname, '..', 'VERSION')
  await writeFile(versionPath, version, 'utf8')
}

// update package metadata files with new version
async function updatePackageJSON (version) {
  ['package.json', 'package-lock.json'].forEach(async fileName => {
    const filePath = path.resolve(__dirname, '..', fileName)
    const file = require(filePath)
    file.version = version
    await writeFile(filePath, JSON.stringify(file, null, 2))
  })
}

// update CFBundle version information and overwrite pre-existing file
// TODO(codebytere): provide these version fields at GN build time
async function updateInfoPlist (version) {
  const filePath = path.resolve(__dirname, '..', 'atom', 'browser', 'resources', 'mac', 'Info.plist')
  const xml = plist.parse(await readFile(filePath, { encoding: 'utf8' }))
  const file = JSON.parse(JSON.stringify(xml))

  file.CFBundleVersion = version
  file.CFBundleShortVersionString = version

  await writeFile(filePath, plist.build(file))
}

// push bump commit to release branch
async function tagVersion (version) {
  const gitDir = path.resolve(__dirname, '..')
  const gitArgs = ['commit', '-a', '-m', `Bump v${version}`, '-n']
  await GitProcess.exec(gitArgs, gitDir)
}

// updates atom_version.h file with new semver values
// TODO(codebytere): auto-generate this
async function updateVersionH (components, pre) {
  const filePath = path.resolve(__dirname, '..', 'atom', 'common', 'atom_version.h')
  const data = await readFile(filePath, 'utf8')
  const arr = data.split('\n')
  arr.forEach((item, idx) => {
    if (item.includes('#define ATOM_MAJOR_VERSION')) {
      item = `#define ATOM_MAJOR_VERSION ${components[0]}`
      arr[idx + 1] = `#define ATOM_MINOR_VERSION ${components[1]}`
      arr[idx + 2] = `#define ATOM_PATCH_VERSION ${components[2]}`
      arr[idx + 4] = pre ? `#define ATOM_PRE_RELEASE_VERSION ${pre}` : '// #define ATOM_PRE_RELEASE_VERSION'
    }
  })
  await writeFile(filePath, arr.join('\n'))
}

// updates atom.rc file with new semver values
async function updateWinRC (components) {
  const filePath = path.resolve(__dirname, '..', 'atom', 'browser', 'resources', 'win', 'atom.rc')
  const data = await readFile(filePath, 'utf8')
  const arr = data.split('\n')
  arr.forEach((line, idx) => {
    if (line.includes('FILEVERSION')) {
      arr[idx] = ` FILEVERSION ${components.join(',')}`
      arr[idx + 1] = ` PRODUCTVERSION ${components.join(',')}`
    } else if (line.includes('FILEVERSION')) {
      arr[idx] = `            VALUE "FileVersion", "${components.slice(0, 3).join('.')}"`
      arr[idx + 5] = `            VALUE "ProductVersion", "${components.slice(0, 3).join('.')}"`
    }
  })
  await writeFile(filePath, arr.join('\n'))
}

if (process.mainModule === module) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}

module.exports = { nextVersion }
