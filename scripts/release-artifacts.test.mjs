import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { collectReleaseArtifacts, createUpdateManifest, verifyReleaseVersion, writeChecksums } from './release-artifacts.mjs';

function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stage0-release-'));
  const files = [
    'x86_64-unknown-linux-gnu-Stage0_2.0.0.AppImage',
    'x86_64-pc-windows-msvc-Stage0_2.0.0-setup.exe',
    'aarch64-apple-darwin-Stage0.app.tar.gz',
    'x86_64-apple-darwin-Stage0.app.tar.gz',
  ];
  const signature = fs.readFileSync(new URL('../backend/src/features/updates/fixtures/payload.sig', import.meta.url));
  for (const name of files) {
    fs.writeFileSync(path.join(directory, name), 'stage0-updater-test-payload');
    fs.writeFileSync(path.join(directory, `${name}.sig`), signature);
  }
  return directory;
}

test('complete release manifest contains exact tags, platform packages and signature contents', () => {
  const directory = fixture();
  try {
    const manifest = createUpdateManifest(directory, '2.0.0', 'Notes', '2026-10-26T00:00:00Z');
    assert.deepEqual(Object.keys(manifest.platforms), ['linux-x86_64', 'windows-x86_64', 'darwin-aarch64', 'darwin-x86_64']);
    for (const platform of Object.values(manifest.platforms)) {
      assert.match(platform.url, /^https:\/\/github.com\/anhquoctran\/stage0\/releases\/download\/v2\.0\.0\//);
      assert.match(Buffer.from(platform.signature, 'base64').toString(), /\tversion:2\.0\.0/);
    }
    assert.throws(() => createUpdateManifest(directory, '2.0.1', ''), /signed version/);
    fs.rmSync(path.join(directory, 'aarch64-apple-darwin-Stage0.app.tar.gz'));
    assert.throws(() => createUpdateManifest(directory, '2.0.0', ''), /darwin-aarch64/);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('duplicate packages, missing signatures and unversioned signatures block publication', () => {
  const directory = fixture();
  const original = path.join(directory, 'x86_64-unknown-linux-gnu-Stage0_2.0.0.AppImage');
  try {
    const duplicate = path.join(directory, 'x86_64-unknown-linux-gnu-duplicate.AppImage');
    fs.copyFileSync(original, duplicate);
    assert.throws(() => createUpdateManifest(directory, '2.0.0', ''), /exactly one linux/);
    fs.rmSync(duplicate);
    fs.rmSync(`${original}.sig`);
    assert.throws(() => createUpdateManifest(directory, '2.0.0', ''), /ENOENT/);
    fs.writeFileSync(`${original}.sig`, Buffer.from('trusted comment: no version').toString('base64'));
    assert.throws(() => createUpdateManifest(directory, '2.0.0', ''), /signed version/);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('collector prevents macOS architecture collisions and checksums remain repeatable', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stage0-collect-'));
  const bundle = path.join(directory, 'bundle'), output = path.join(directory, 'output');
  fs.mkdirSync(bundle); fs.writeFileSync(path.join(bundle, 'Stage0.app.tar.gz'), 'package');
  fs.writeFileSync(path.join(bundle, 'Stage0.app.tar.gz.sig'), 'signature');
  try {
    collectReleaseArtifacts(bundle, output, 'aarch64-apple-darwin');
    collectReleaseArtifacts(bundle, output, 'x86_64-apple-darwin');
    assert.equal(fs.readdirSync(output).length, 4);
    assert.throws(() => collectReleaseArtifacts(bundle, output, 'x86_64-apple-darwin'), /Duplicate/);
    writeChecksums(output);
    const checksums = fs.readFileSync(path.join(output, 'SHA256SUMS.txt'), 'utf8');
    writeChecksums(output);
    assert.equal(fs.readFileSync(path.join(output, 'SHA256SUMS.txt'), 'utf8'), checksums);
    assert.equal(checksums.trim().split('\n').length, 4);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('release validation rejects tag and package version drift without bumping files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stage0-version-gate-'));
  fs.mkdirSync(path.join(root, 'backend'));
  const config = { version: '2.0.0', bundle: { createUpdaterArtifacts: true }, plugins: { updater: { requireSignedVersion: true } } };
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '2.0.0' }));
  fs.writeFileSync(path.join(root, 'backend/tauri.conf.json'), JSON.stringify(config));
  fs.writeFileSync(path.join(root, 'backend/Cargo.toml'), '[package]\nversion = "2.0.0"\n');
  fs.writeFileSync(path.join(root, 'backend/Cargo.lock'), '[[package]]\nname = "stage0"\nversion = "2.0.0"\n');
  try {
    assert.equal(verifyReleaseVersion(root, 'v2.0.0'), '2.0.0');
    assert.throws(() => verifyReleaseVersion(root, 'v2.0.1'), /must match/);
    assert.throws(() => verifyReleaseVersion(root, 'v2.0.0-beta.1'), /Release version/);
    fs.writeFileSync(path.join(root, 'backend/Cargo.lock'), '[[package]]\nname = "stage0"\nversion = "1.0.0"\n');
    assert.throws(() => verifyReleaseVersion(root, 'v2.0.0'), /must match/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).version, '2.0.0');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
