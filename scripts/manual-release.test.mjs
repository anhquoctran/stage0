import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { nextStableVersion, prepareManualRelease } from './manual-release.mjs';

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stage0-manual-release-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const origin = path.join(dir, 'origin.git'), root = path.join(dir, 'source');
  fs.mkdirSync(root);
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '--bare', origin);
  git('init');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.test');
  git('remote', 'add', 'origin', origin);
  for (const dir of ['scripts', 'shared', 'backend', 'website']) fs.mkdirSync(path.join(root, dir));
  for (const name of ['prepare-release.mjs', 'release-channels.mjs', 'bump-version.mjs', 'generate-about-info.mjs']) {
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
  return { root, origin, git, sourceSha, branch };
}

test('manual dispatch chooses the next free stable patch without reviving legacy 0.1.x', () => {
  assert.equal(nextStableVersion('0.0.1', []), '0.0.1');
  assert.equal(nextStableVersion('0.0.1', ['v0.1.12', 'v0.0.2-beta.20261101.7']), '0.0.1');
  assert.equal(nextStableVersion('0.0.1', ['v0.0.8', 'v0.0.1', 'v0.0.3']), '0.0.9');
  assert.equal(nextStableVersion('0.0.10', ['v0.0.1']), '0.0.10');
  assert.throws(() => nextStableVersion('0.0.2-beta.20261101.1', []), /stable package/);
});

test('one click prepares and pushes an immutable version tag; reruns reuse it and main stays unchanged', t => {
  const f = fixture(t);
  const first = prepareManualRelease({ root: f.root, runId: '101', sourceSha: f.sourceSha });
  assert.equal(first.tag, 'v0.0.1');
  assert.equal(f.git('rev-parse', `refs/heads/${f.branch}`), f.sourceSha);
  assert.notEqual(first.sha, f.sourceSha);
  const remote = execFileSync('git', ['--git-dir', f.origin, 'rev-parse', first.tag], { encoding: 'utf8' }).trim();
  assert.equal(remote, first.sha);
  assert.equal(JSON.parse(f.git('show', `${first.tag}:package.json`)).version, '0.0.1');
  assert.deepEqual(prepareManualRelease({ root: f.root, runId: '101', sourceSha: f.sourceSha }), first);
  const second = prepareManualRelease({ root: f.root, runId: '102', sourceSha: f.sourceSha });
  assert.equal(second.tag, 'v0.0.2');
  assert.equal(JSON.parse(f.git('show', `${second.tag}:backend/about.json`)).packageVersion, '0.0.2');
  assert.equal(f.git('rev-parse', first.tag), first.sha, 'Earlier tags are never rewritten');
  assert.equal(f.git('rev-parse', `refs/heads/${f.branch}`), f.sourceSha);
  assert.throws(() => prepareManualRelease({ root: f.root, runId: '101', sourceSha: second.sha }), /source mismatch/);
});

test('manual UI has no required tag field and all jobs consume the resolved immutable SHA', () => {
  const workflow = fs.readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');
  assert.match(workflow, /workflow_dispatch:\s+workflow_call:/);
  assert.equal((workflow.match(/ref: \$\{\{ needs.prepare.outputs.sha \}\}/g) || []).length, 3);
  assert.match(workflow, /needs: \[prepare, validate\]/);
  assert.match(workflow, /needs: \[prepare, build\]/);
  assert.match(workflow, /Refusing to replace an already published release/);
});
