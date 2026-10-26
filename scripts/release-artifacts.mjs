import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const platforms = {
  'linux-x86_64': ['x86_64-unknown-linux-gnu', '.AppImage'],
  'windows-x86_64': ['x86_64-pc-windows-msvc', '.exe'],
  'darwin-aarch64': ['aarch64-apple-darwin', '.app.tar.gz'],
  'darwin-x86_64': ['x86_64-apple-darwin', '.app.tar.gz'],
};

function filesIn(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(file) : entry.isFile() ? [file] : [];
  });
}

export function verifyReleaseVersion(root, tag) {
  if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag)) {
    throw new Error('Release tags must use vMAJOR.MINOR.PATCH (stable channel).');
  }
  const version = tag.slice(1);
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
  if (!Object.values(platforms).some(([expected]) => expected === target)) throw new Error('Unsupported release target');
  fs.mkdirSync(destination, { recursive: true });
  const packages = filesIn(bundleDir).filter((file) => /(?:\.AppImage|\.exe|\.msi|\.deb|\.rpm|\.dmg|\.app\.tar\.gz)$/.test(file));
  if (!packages.length) throw new Error('No release packages were produced');
  for (const file of packages) {
    const output = path.join(destination, `${target}-${path.basename(file)}`);
    if (fs.existsSync(output)) throw new Error(`Duplicate release asset: ${path.basename(output)}`);
    fs.copyFileSync(file, output);
    if (fs.existsSync(`${file}.sig`)) fs.copyFileSync(`${file}.sig`, `${output}.sig`);
  }
}

export function createUpdateManifest(directory, version, notes, pubDate = new Date().toISOString()) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) throw new Error('Invalid release version');
  const files = filesIn(directory);
  const manifest = { version, notes, pub_date: pubDate, platforms: {} };
  for (const [platform, [target, extension]] of Object.entries(platforms)) {
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
