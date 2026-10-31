import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { policy, releaseChannel, scheduledVersion } from './release-channels.mjs';
import { setProjectVersion } from './bump-version.mjs';
import { verifyReleaseVersion, createUpdateManifest } from './release-artifacts.mjs';

test('quarter cadence promotes the next preview core; UTC date/build identify prereleases', () => {
  const now = new Date('2026-10-31T17:17:00Z');
  assert.equal(scheduledVersion('stable', now), '0.0.1');
  assert.equal(scheduledVersion('nightly', now, '42'), '0.0.2-nightly.20261031.42');
  assert.equal(scheduledVersion('beta', now, '43'), '0.0.2-beta.20261031.43');
  assert.equal(scheduledVersion('stable', new Date('2027-01-01Z')), '0.0.2');
  assert.equal(scheduledVersion('stable', new Date('2027-04-01Z')), '0.0.3');
  assert.equal(scheduledVersion('nightly', new Date('2027-01-01Z')), '0.0.3-nightly.20270101.1');
  assert.throws(() => scheduledVersion('rc', now));
  assert.throws(() => scheduledVersion('beta', now, '01'));
  assert.throws(() => scheduledVersion('stable', new Date('invalid')));
});

test('release vocabulary rejects malformed SemVer, unknown channels and invalid dates', () => {
  for (const [version, expected] of [['0.0.1', 'stable'], ['0.0.2-nightly.20261031.5', 'nightly'], ['0.0.2-beta.20261101.6', 'beta']]) {
    assert.equal(releaseChannel(version), expected);
  }
  for (const version of ['v0.0.1', '0.0.01', '0.0.1-stable', '0.0.1-rc.1', '0.0.1-beta.20260230.1', '0.0.1-nightly.20261031.01', '0.0.1-beta.1']) {
    assert.throws(() => releaseChannel(version));
  }
});

test('all release channels round-trip package/config/Cargo and signed-version manifest gates', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stage0-channel-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'backend'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '0.0.1' }));
  fs.writeFileSync(path.join(root, 'backend/tauri.conf.json'), JSON.stringify({ version: '0.0.1', bundle: { createUpdaterArtifacts: true }, plugins: { updater: { requireSignedVersion: true } } }));
  fs.writeFileSync(path.join(root, 'backend/Cargo.toml'), '[package]\nversion = "0.0.1"\n');
  fs.writeFileSync(path.join(root, 'backend/Cargo.lock'), '[[package]]\nname = "stage0"\nversion = "0.0.1"\n');
  for (const version of ['0.0.1', '0.0.2-nightly.20261031.10', '0.0.2-beta.20261031.11']) {
    setProjectVersion(version, root);
    assert.equal(verifyReleaseVersion(root, `v${version}`), version);
    // Prerelease manifests must reach the same mandatory package/signature gates.
    assert.throws(() => createUpdateManifest(root, version, ''), /exactly one linux/);
  }
});

test('workflow cron matches the canonical policy and prereleases never become latest', () => {
  const schedule = fs.readFileSync(new URL('../.github/workflows/scheduled-release.yml', import.meta.url), 'utf8');
  for (const { cron } of Object.values(policy.channels)) assert.ok(schedule.includes(`cron: '${cron}'`));
  const release = fs.readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');
  assert.match(release, /--draft=false --prerelease --latest=false/);
  assert.match(release, /--draft=false --prerelease=false --latest/);
});

test('preparing a prerelease synchronizes About, release notes and website without modifying the source checkout', async t => {
  const { spawnSync } = await import('node:child_process');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stage0-prepare-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const dir of ['scripts', 'shared', 'backend', 'website']) fs.mkdirSync(path.join(root, dir));
  for (const name of ['prepare-release.mjs', 'release-channels.mjs', 'bump-version.mjs', 'generate-about-info.mjs']) {
    fs.copyFileSync(new URL(name, import.meta.url), path.join(root, 'scripts', name));
  }
  fs.copyFileSync(new URL('../shared/release-channels.json', import.meta.url), path.join(root, 'shared/release-channels.json'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '0.0.1', type: 'module' }));
  fs.writeFileSync(path.join(root, 'backend/Cargo.toml'), '[package]\nversion = "0.0.1"\n');
  fs.writeFileSync(path.join(root, 'backend/Cargo.lock'), '[[package]]\nname = "stage0"\nversion = "0.0.1"\n');
  fs.writeFileSync(path.join(root, 'backend/tauri.conf.json'), JSON.stringify({ version: '0.0.1' }));
  fs.writeFileSync(path.join(root, 'RELEASE_NOTES.md'), '# Stage0 v0.0.1 Release Notes\nThis document describes the current release (v0.0.1).\nCode: `x` ${literal}\n');
  fs.writeFileSync(path.join(root, 'website/index.html'), 'v0.0.1');
  const version = '0.0.2-beta.20261031.7';
  const result = spawnSync(process.execPath, ['scripts/prepare-release.mjs', 'set', version], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'backend/about.json'))).packageVersion, version);
  assert.equal(fs.readFileSync(path.join(root, 'website/index.html'), 'utf8'), `v${version}`);
  const source = fs.readFileSync(path.join(root, 'frontend/features/about/config/releaseNotes.ts'), 'utf8');
  const notes = new Function(source.replace('export const DEFAULT_RELEASE_NOTES =', 'return'))();
  assert.equal(notes, fs.readFileSync(path.join(root, 'RELEASE_NOTES.md'), 'utf8'));
  assert.ok(notes.includes(`v${version}`));
  assert.ok(notes.includes('`x` ${literal}'));
});
