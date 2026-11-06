import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { nextStableVersion, prepareManualRelease } from './manual-release.mjs';
import { commandFixture } from './helpers/commandFixture.mjs';

function fixture(t, date) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stage0-manual-release-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const origin = path.join(dir, 'origin.git'), root = path.join(dir, 'source');
  fs.mkdirSync(root);
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...(date ? { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : {}) } }).trim();
  git('init', '--bare', origin);
  git('init');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.test');
  git('remote', 'add', 'origin', origin);
  for (const dir of ['scripts', 'shared', 'backend', 'website']) fs.mkdirSync(path.join(root, dir));
  for (const name of ['manual-release.mjs', 'prepare-release.mjs', 'release-promotion.mjs', 'release-regression-preservation.mjs', 'release-regression-runner.mjs', 'release-promotion-source.mjs', 'release-rollup.mjs', 'release-rollup-tree.mjs', 'release-period.mjs', 'release-promotion-github.mjs', 'release-channels.mjs', 'release-history.mjs', 'release-changelog.mjs', 'bump-version.mjs', 'generate-about-info.mjs']) {
    fs.copyFileSync(new URL(name, import.meta.url), path.join(root, 'scripts', name));
  }
  fs.copyFileSync(new URL('../shared/release-channels.json', import.meta.url), path.join(root, 'shared/release-channels.json'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '0.0.1', type: 'module' }));
  fs.writeFileSync(path.join(root, 'backend/Cargo.toml'), '[package]\nversion = "0.0.1"\n');
  fs.writeFileSync(path.join(root, 'backend/Cargo.lock'), '[[package]]\nname = "stage0"\nversion = "0.0.1"\n');
  fs.writeFileSync(path.join(root, 'backend/tauri.conf.json'), JSON.stringify({ version: '0.0.1' }));
  fs.writeFileSync(path.join(root, 'RELEASE_NOTES.md'), '# Stage0 v0.0.1 Release Notes\n');
  fs.writeFileSync(path.join(root, 'website/index.html'), 'v0.0.1');
  git('add', '.'); git('commit', '-m', 'Source snapshot');
  const sourceSha = git('rev-parse', 'HEAD');
  const branch = git('branch', '--show-current');
  const mock = commandFixture(dir, 'gh', () => '[[]]');
  return { root, origin, git, sourceSha, branch, mock };
}

test('manual dispatch chooses the next free stable patch across all channel tags without reviving legacy 0.1.x', () => {
  assert.equal(nextStableVersion('0.0.1', []), '0.0.1');
  assert.equal(nextStableVersion('0.0.1', ['v0.1.12']), '0.0.1');
  assert.equal(nextStableVersion('0.0.1', ['v0.1.12', 'v0.0.2-nightly', 'v0.0.3-beta']), '0.0.4');
  assert.equal(nextStableVersion('0.0.1', ['v0.0.8', 'v0.0.1', 'v0.0.3']), '0.0.9');
  assert.equal(nextStableVersion('0.0.10', ['v0.0.1']), '0.0.10');
  assert.throws(() => nextStableVersion('0.0.2-beta', []), /stable package/);
});

test('one click prepares and pushes an immutable version tag; reruns reuse it and main stays unchanged', t => {
  const f = fixture(t);
  const first = prepareManualRelease({ promotionGuard: () => null, root: f.root, runId: '101', sourceSha: f.sourceSha, releases: [] });
  assert.equal(first.tag, 'v0.0.1');
  assert.equal(f.git('rev-parse', `refs/heads/${f.branch}`), f.sourceSha);
  assert.notEqual(first.sha, f.sourceSha);
  const remote = execFileSync('git', ['--git-dir', f.origin, 'rev-parse', first.tag], { encoding: 'utf8' }).trim();
  assert.equal(remote, first.sha);
  assert.equal(JSON.parse(f.git('show', `${first.tag}:package.json`)).version, '0.0.1');
  assert.deepEqual(prepareManualRelease({ promotionGuard: () => null, root: f.root, runId: '101', sourceSha: f.sourceSha, releases: [] }), first);
  const second = prepareManualRelease({ promotionGuard: () => null, root: f.root, runId: '102', sourceSha: f.sourceSha, releases: [] });
  assert.equal(second.tag, 'v0.0.2');
  assert.equal(JSON.parse(f.git('show', `${second.tag}:backend/about.json`)).packageVersion, '0.0.2');
  assert.equal(f.git('rev-parse', first.tag), first.sha, 'Earlier tags are never rewritten');
  assert.equal(f.git('rev-parse', `refs/heads/${f.branch}`), f.sourceSha);
  assert.throws(() => prepareManualRelease({ promotionGuard: () => null, root: f.root, runId: '101', sourceSha: second.sha, releases: [] }), /source mismatch/);
});

test('actual stable tag dispatch refuses uncertified source without changing tags', t => {
  const f = fixture(t);
  const release = prepareManualRelease({ promotionGuard: () => null, root: f.root, runId: '101', sourceSha: f.sourceSha, releases: [] });
  assert.throws(() => execFileSync(process.execPath, [...f.mock, 'scripts/manual-release.mjs'], { cwd: f.root, stdio: 'pipe', env: {
    ...process.env, RELEASE_EVENT: 'workflow_dispatch', RELEASE_REF_TYPE: 'tag',
    RELEASE_INPUT_TAG: release.tag, RELEASE_SOURCE_SHA: release.sha,
  } }), /approved beta promotion PR/);
  assert.equal(f.git('tag', '--list'), release.tag);
  assert.equal(f.git('rev-parse', 'HEAD'), release.sha);
});

test('release preparation uses preloaded controller code rather than executing checked-out tooling', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.root, 'scripts/prepare-release.mjs'), 'throw new Error("untrusted source code executed");');
  f.git('add', 'scripts/prepare-release.mjs');
  f.git('commit', '-m', 'Change source tooling');
  const sourceSha = f.git('rev-parse', 'HEAD');
  const release = prepareManualRelease({ promotionGuard: () => null, root: f.root, runId: '103', sourceSha, releases: [] });
  assert.equal(JSON.parse(f.git('show', `${release.sha}:package.json`)).version, '0.0.1');
  assert.equal(f.git('show', `${release.sha}:scripts/prepare-release.mjs`), 'throw new Error("untrusted source code executed");');
});

test('actual preview tag entry points skip stale sources and accept fresh sources without preparing another tag', async t => {
  for (const event of ['push', 'workflow_dispatch']) {
    for (const stale of [true, false]) {
      await t.test(`${event}, ${stale ? 'stale' : 'fresh'}`, t => {
        const f = fixture(t, stale ? '2000-01-01T00:00:00Z' : undefined);
        const tag = 'v0.0.2-nightly';
        f.git('tag', tag);
        const output = path.join(f.root, 'outputs'), summary = path.join(f.root, 'summary');
        execFileSync(process.execPath, [...f.mock, 'scripts/manual-release.mjs'], { cwd: f.root, env: {
          ...process.env,
          RELEASE_EVENT: event, RELEASE_REF_TYPE: 'tag', RELEASE_INPUT_TAG: tag,
          GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary,
        } });
        assert.match(fs.readFileSync(output, 'utf8'), new RegExp(`should_build=${!stale}\\n`));
        assert.equal(f.git('tag', '--list'), tag);
        assert.equal(f.git('rev-parse', 'HEAD'), f.sourceSha);
        if (stale) assert.match(fs.readFileSync(summary, 'utf8'), /Skipped nightly: No new source commits in the last 24 hours/);
      });
    }
  }
});

test('manual UI needs no tag and release jobs pin the event SHA inside the tag run', () => {
  const workflow = fs.readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');
  assert.doesNotMatch(workflow.match(/workflow_dispatch:([\s\S]*?)workflow_call:/)[1], /\n\s+tag:/);
  assert.equal((workflow.match(/ref: \$\{\{ github.sha \}\}/g) || []).length, 4);
  assert.doesNotMatch(workflow, /ref: \$\{\{ needs.prepare.outputs.sha \}\}/);
  assert.match(workflow, /validate:\s+(?:#[^\n]*\n\s+)?if: github.ref_type == 'tag'/);
  assert.match(workflow, /if: github.ref_type != 'tag'/);
  assert.match(workflow, /node scripts\/dispatch-tag-release.mjs/);
  assert.match(workflow, /needs: \[prepare, validate\]/);
  assert.match(workflow, /needs: \[prepare, build\]/);
  assert.match(workflow, /Refusing to replace an already published release/);
});
