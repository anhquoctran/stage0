#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT_DIR = path.resolve(SCRIPT_DIR, '..');

export function incrementPatch(version) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(version);
  if (!match) {
    throw new Error(`Project version is not valid SemVer: ${version}`);
  }

  const prereleaseIdentifiers = match[4]?.split('.') ?? [];
  if (prereleaseIdentifiers.some((part) => /^\d+$/.test(part) && part.length > 1 && part.startsWith('0'))) {
    throw new Error(`Project version is not valid SemVer: ${version}`);
  }

  return `${match[1]}.${match[2]}.${BigInt(match[3]) + 1n}`;
}

function replaceCargoPackageVersion(cargoToml, nextVersion) {
  const versionLine = /^version\s*=\s*"[^"]+"\s*$/m;
  if (!versionLine.test(cargoToml)) {
    throw new Error('Could not find the package version in backend/Cargo.toml');
  }
  return cargoToml.replace(versionLine, `version = "${nextVersion}"`);
}

function replaceCargoLockPackageVersion(cargoLock, nextVersion) {
  const packageSections = cargoLock.split(/(?=^\[\[package\]\]\s*$)/m);
  let matches = 0;
  const updatedSections = packageSections.map((section) => {
    if (!/^name = "stage0"$/m.test(section)) return section;

    const versionLine = /^version = "[^"]+"$/m;
    if (!versionLine.test(section)) {
      throw new Error('Could not find the stage0 package version in backend/Cargo.lock');
    }

    matches += 1;
    return section.replace(versionLine, `version = "${nextVersion}"`);
  });

  if (matches !== 1) {
    throw new Error(`Expected one stage0 package entry in backend/Cargo.lock, found ${matches}`);
  }
  return updatedSections.join('');
}

function writeFileAtomically(filePath, contents) {
  const temporaryPath = `${filePath}.tmp-${process.pid}`;
  try {
    fs.writeFileSync(temporaryPath, contents, { encoding: 'utf8', flag: 'wx' });
    fs.renameSync(temporaryPath, filePath);
  } catch (error) {
    try {
      fs.rmSync(temporaryPath, { force: true });
    } catch {
      // Preserve the original write/rename error.
    }
    throw error;
  }
}

export function bumpProjectPatchVersion(rootDir = DEFAULT_ROOT_DIR) {
  const packagePath = path.join(rootDir, 'package.json');
  const cargoTomlPath = path.join(rootDir, 'backend', 'Cargo.toml');
  const cargoLockPath = path.join(rootDir, 'backend', 'Cargo.lock');
  const tauriConfigPath = path.join(rootDir, 'backend', 'tauri.conf.json');

  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const nextVersion = incrementPatch(packageJson.version);
  const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf8'));
  const cargoToml = fs.readFileSync(cargoTomlPath, 'utf8');
  const cargoLock = fs.readFileSync(cargoLockPath, 'utf8');

  const previousVersion = packageJson.version;
  packageJson.version = nextVersion;
  tauriConfig.version = nextVersion;

  const updatedFiles = [
    [packagePath, `${JSON.stringify(packageJson, null, 2)}\n`],
    [cargoTomlPath, replaceCargoPackageVersion(cargoToml, nextVersion)],
    [cargoLockPath, replaceCargoLockPackageVersion(cargoLock, nextVersion)],
    [tauriConfigPath, `${JSON.stringify(tauriConfig, null, 2)}\n`],
  ];

  for (const [filePath, contents] of updatedFiles) {
    writeFileAtomically(filePath, contents);
  }

  return { previousVersion, version: nextVersion };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = bumpProjectPatchVersion();
    console.log(`Project version bumped: ${result.previousVersion} -> ${result.version}`);
  } catch (error) {
    console.error(`Failed to bump project version: ${error.message}`);
    process.exitCode = 1;
  }
}
