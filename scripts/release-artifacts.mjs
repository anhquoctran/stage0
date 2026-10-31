import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { releaseChannel } from './release-channels.mjs';
import { fileURLToPath } from 'node:url';

const updaterPlatforms = {
  'linux-x86_64-appimage': ['x86_64-unknown-linux-gnu', '.AppImage'],
  'linux-x86_64-deb': ['x86_64-unknown-linux-gnu', '.deb'],
  'linux-x86_64-rpm': ['x86_64-unknown-linux-gnu', '.rpm'],
  'linux-aarch64-deb': ['aarch64-unknown-linux-gnu', '.deb'],
  'linux-aarch64-rpm': ['aarch64-unknown-linux-gnu', '.rpm'],
  'windows-x86_64-nsis': ['x86_64-pc-windows-msvc', '.exe'],
  'windows-aarch64-nsis': ['aarch64-pc-windows-msvc', '.exe'],
  'darwin-aarch64-app': ['aarch64-apple-darwin', '.app.tar.gz'],
  'darwin-x86_64-app': ['x86_64-apple-darwin', '.app.tar.gz'],
};

const legacyUpdaterAliases = {
  'linux-x86_64': 'linux-x86_64-appimage',
  'windows-x86_64': 'windows-x86_64-nsis',
  'darwin-aarch64': 'darwin-aarch64-app',
  'darwin-x86_64': 'darwin-x86_64-app',
};

const requiredReleaseBundles = {
  'x86_64-unknown-linux-gnu': ['.AppImage', '.deb', '.rpm'],
  'aarch64-unknown-linux-gnu': ['.deb', '.rpm'],
  'x86_64-pc-windows-msvc': ['.exe'],
  'aarch64-pc-windows-msvc': ['.exe'],
  'aarch64-apple-darwin': ['.dmg', '.app.tar.gz'],
  'x86_64-apple-darwin': ['.dmg', '.app.tar.gz'],
};

function filesIn(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(file) : entry.isFile() ? [file] : [];
  });
}

export function verifyReleaseVersion(root, tag) {
  if (!tag?.startsWith('v')) throw new Error('Release tag must start with v');
  const version = tag.slice(1);
  releaseChannel(version);
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const config = JSON.parse(fs.readFileSync(path.join(root, 'backend/tauri.conf.json'), 'utf8'));
  const cargo = fs.readFileSync(path.join(root, 'backend/Cargo.toml'), 'utf8');
  const lock = fs.readFileSync(path.join(root, 'backend/Cargo.lock'), 'utf8');
  const cargoVersion = cargo.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
  const lockVersion = lock.match(/^name = "stage0"\r?\nversion = "([^"]+)"/m)?.[1];
  if ([packageJson.version, config.version, cargoVersion, lockVersion].some((actual) => actual !== version)) {
    throw new Error('Tag, package.json, Cargo.toml, Cargo.lock and Tauri versions must match.');
  }
  if (!config.bundle.createUpdaterArtifacts || !config.plugins.updater?.requireSignedVersion) {
    throw new Error('Release builds require signed, version-bound updater artifacts.');
  }
  return version;
}

export function collectReleaseArtifacts(bundleDir, destination, target) {
  if (!requiredReleaseBundles[target]) throw new Error('Unsupported release target');
  fs.mkdirSync(destination, { recursive: true });
  const packages = filesIn(bundleDir).filter((file) => /(?:\.AppImage|\.exe|\.msi|\.deb|\.rpm|\.dmg|\.app\.tar\.gz)$/.test(file));
  if (!packages.length) throw new Error('No release packages were produced');
  const producedNames = packages.map((file) => path.basename(file));
  for (const extension of requiredReleaseBundles[target]) {
    if (!producedNames.some((name) => name.endsWith(extension))) {
      throw new Error(`Missing required ${target} release bundle: ${extension}`);
    }
  }
  for (const file of packages) {
    const output = path.join(destination, `${target}-${path.basename(file)}`);
    if (fs.existsSync(output)) throw new Error(`Duplicate release asset: ${path.basename(output)}`);
    fs.copyFileSync(file, output);
    if (fs.existsSync(`${file}.sig`)) fs.copyFileSync(`${file}.sig`, `${output}.sig`);
  }
}

export function createUpdateManifest(directory, version, notes, pubDate = new Date().toISOString()) {
  releaseChannel(version);
  const files = filesIn(directory);
  const manifest = { version, notes, pub_date: pubDate, platforms: {} };
  for (const [platform, [target, extension]] of Object.entries(updaterPlatforms)) {
    const matches = files.filter((file) => path.basename(file).startsWith(`${target}-`) && file.endsWith(extension));
    if (matches.length !== 1) throw new Error(`Expected exactly one ${platform} updater package, found ${matches.length}`);
    const file = matches[0];
    const signature = fs.readFileSync(`${file}.sig`, 'utf8').trim();
    const decoded = Buffer.from(signature, 'base64').toString('utf8');
    const trusted = decoded.split(/\r?\n/).find((line) => line.startsWith('trusted comment: '));
    // This checks format only. The Rust release verifier authenticates this comment and the bytes.
    if (!trusted?.split('\t').includes(`version:${version}`)) throw new Error(`Missing matching signed version: ${path.basename(file)}`);
    manifest.platforms[platform] = {
      signature,
      url: `https://github.com/anhquoctran/stage0/releases/download/v${version}/${encodeURIComponent(path.basename(file))}`,
    };
  }
  for (const [alias, platform] of Object.entries(legacyUpdaterAliases)) {
    manifest.platforms[alias] = manifest.platforms[platform];
  }

  for (const [target, extensions] of Object.entries(requiredReleaseBundles)) {
    for (const extension of extensions) {
      const matches = files.filter((file) => path.basename(file).startsWith(`${target}-`) && file.endsWith(extension));
      if (matches.length !== 1) throw new Error(`Expected exactly one ${target} release bundle ${extension}, found ${matches.length}`);
    }
  }
  return manifest;
}

export function writeChecksums(directory) {
  const files = filesIn(directory).filter((file) => path.basename(file) !== 'SHA256SUMS.txt').sort();
  const lines = files.map((file) => {
    const hash = crypto.createHash('sha256');
    const descriptor = fs.openSync(file, 'r');
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    try {
      let read;
      while ((read = fs.readSync(descriptor, buffer, 0, buffer.length, null))) hash.update(buffer.subarray(0, read));
    } finally { fs.closeSync(descriptor); }
    return `${hash.digest('hex')}  ${path.relative(directory, file).replaceAll(path.sep, '/')}`;
  });
  fs.writeFileSync(path.join(directory, 'SHA256SUMS.txt'), `${lines.join('\n')}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'version') console.log(verifyReleaseVersion(process.cwd(), args[0]));
  else if (command === 'collect') collectReleaseArtifacts(...args);
  else if (command === 'manifest') {
    const [directory, tag] = args;
    const version = verifyReleaseVersion(process.cwd(), tag);
    const notes = fs.readFileSync('RELEASE_NOTES.md', 'utf8');
    fs.writeFileSync(path.join(directory, 'latest.json'), `${JSON.stringify(createUpdateManifest(directory, version, notes), null, 2)}\n`);
    writeChecksums(directory);
  } else throw new Error('Usage: release-artifacts.mjs version TAG | collect BUNDLE_DIR OUTPUT TARGET | manifest DIRECTORY TAG');
}
