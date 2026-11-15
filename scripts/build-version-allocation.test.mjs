import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { nextBuildVersion, scheduledVersion, policy } from './release-channels.mjs';
import { nextStableVersion, prepareManualRelease } from './manual-release.mjs';
import { prepareScheduledBranch } from './prepare-release.mjs';
import { verifyReleaseVersion } from './release-artifacts.mjs';

const tags = ['v0.0.1', 'v0.0.2', 'v0.0.3', 'v0.0.4', 'v0.0.5-nightly', 'v0.0.13-nightly',
  'v0.0.99-nightly.20261112.1', 'channel-nightly'];

test('the next build after 0.0.4 is 0.0.5, excluding retired channel history without deleting it', () => {
  assert.equal(nextBuildVersion('stable', tags, '0.0.4'), '0.0.5');
  assert.equal(nextBuildVersion('beta', tags, '0.0.4'), '0.0.5-beta');
  assert.equal(nextStableVersion('0.0.4', tags), '0.0.5');
  assert.equal(nextBuildVersion('stable', [], '0.0.4'), '0.0.5');
  assert.equal(nextBuildVersion('beta', [], '0.0.4'), '0.0.5-beta');
  assert.equal(nextBuildVersion('stable', [...tags, 'v0.0.5-beta'], '0.0.4'), '0.0.6');
  assert.equal(nextBuildVersion('beta', [...tags, 'v0.0.6'], '0.0.4'), '0.0.7-beta');
  assert.equal(nextBuildVersion('stable', [...tags, 'v0.1.99'], '0.0.4'), '0.0.5');
  assert.throws(() => nextBuildVersion('nightly', tags, '0.0.4'));
  assert.throws(() => nextBuildVersion('stable', tags, '0.0.4-beta'));
  assert.throws(() => nextBuildVersion('stable', 'not an array', '0.0.4'));
});

test('calendar planning applies the same active-channel allocation as actual preparation', () => {
  assert.equal(scheduledVersion('beta', new Date('2026-11-27T00:00:00Z'), tags), nextBuildVersion('beta', tags));
  assert.equal(scheduledVersion('stable', new Date('2027-01-01T00:00:00Z'), tags), nextBuildVersion('stable', tags));
});

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stage0-build-version-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'backend')); fs.mkdirSync(path.join(root, 'website'));
  fs.writeFileSync(path.join(root, 'package.json'), '{"version":"0.0.4","type":"module"}\n');
  fs.writeFileSync(path.join(root, 'backend/tauri.conf.json'), JSON.stringify({ version: '0.0.4', bundle: { createUpdaterArtifacts: true }, plugins: { updater: { requireSignedVersion: true } } }));
  fs.writeFileSync(path.join(root, 'backend/Cargo.toml'), '[package]\nversion = "0.0.4"\n');
  fs.writeFileSync(path.join(root, 'backend/Cargo.lock'), '[[package]]\nname = "stage0"\nversion = "0.0.4"\n');
  fs.writeFileSync(path.join(root, 'RELEASE_NOTES.md'), '# Stage0 v0.0.4 Release Notes\n');
  fs.writeFileSync(path.join(root, 'website/index.html'), '0.0.4');
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
  git('init', '-b', 'main'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.test');
  git('remote', 'add', 'origin', root); git('add', '.'); git('commit', '-m', 'Current build');
  for (const tag of tags) git('tag', tag);
  git('branch', 'beta'); git('branch', 'develop');
  return { root, git, sha: git('rev-parse', 'HEAD') };
}

test('manual preparation increments exactly once and retries keep the same tag and source', t => {
  const f = fixture(t), options = { root: f.root, runId: '101', sourceSha: f.sha, releases: [], promotionGuard: () => {} };
  const first = prepareManualRelease(options);
  assert.equal(first.tag, 'v0.0.5');
  assert.equal(verifyReleaseVersion(f.root, first.tag), '0.0.5');
  assert.deepEqual(prepareManualRelease(options), first);
  assert.equal(f.git('rev-parse', 'main'), f.sha);
  assert.equal(f.git('tag', '--list', '*nightly*').split('\n').length, tags.filter(tag => tag.includes('nightly')).length);
});

test('scheduled preparation uses the project baseline and reserves prior active tags while leaving history intact', t => {
  const f = fixture(t);
  const result = prepareScheduledBranch({ root: f.root, schedule: 'beta', now: new Date('2026-11-27T00:00:00Z'),
    releases: [], promotionGuard: () => {}, onlyChannel: true });
  assert.equal(result.tag, `v${nextBuildVersion('beta', tags, policy.baseVersion)}`);
  assert.equal(verifyReleaseVersion(f.root, result.tag), result.version);
  assert.equal(f.git('rev-parse', 'beta'), f.sha);
  assert.equal(f.git('rev-parse', 'v0.0.13-nightly'), f.sha);
});
