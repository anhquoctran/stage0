import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { dispatchTagRelease } from './dispatch-tag-release.mjs';

const environment = () => ({ GITHUB_REPOSITORY: 'anhquoctran/stage0', GITHUB_REF: 'refs/heads/main',
  GITHUB_REF_TYPE: 'branch', RELEASE_TAG: 'v0.0.8-nightly', RELEASE_SNAPSHOT_SHA: 'a'.repeat(40),
  RELEASE_PUBLISH_AT: '2026-11-05T00:00:00.000Z', GH_TOKEN: 'fixture-not-a-real-token' });

test('main controller dispatches the immutable tag context and retains the publication window', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stage0-dispatch-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const env = { ...environment(), GITHUB_STEP_SUMMARY: path.join(root, 'summary') };
  const calls = [];
  const result = await dispatchTagRelease(env, async (...args) => { calls.push(args); return { ok: true }; });
  assert.equal(calls.length, 1);
  const [url, options] = calls[0];
  assert.equal(url, 'https://api.github.com/repos/anhquoctran/stage0/actions/workflows/release.yml/dispatches');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers.Authorization, `Bearer ${env.GH_TOKEN}`);
  assert.deepEqual(JSON.parse(options.body), { ref: env.RELEASE_TAG,
    inputs: { source_sha: env.RELEASE_SNAPSHOT_SHA, publish_at: env.RELEASE_PUBLISH_AT } });
  const summary = fs.readFileSync(env.GITHUB_STEP_SUMMARY, 'utf8');
  assert.ok(summary.includes('Release build requested'));
  assert.ok(!summary.includes(env.GH_TOKEN));
  assert.equal(result.sha, env.RELEASE_SNAPSHOT_SHA);
});

test('tag runs cannot recursively dispatch; invalid refs, identity and publication data fail before HTTP', async () => {
  for (const changes of [
    { GITHUB_REF_TYPE: 'tag', GITHUB_REF: 'refs/tags/v0.0.8-nightly' },
    { GITHUB_REF: 'refs/heads/feat/untrusted' }, { GITHUB_REPOSITORY: 'another/repo' },
    { RELEASE_TAG: 'v0.0.8;unsafe' }, { RELEASE_TAG: 'v../main' },
    { RELEASE_SNAPSHOT_SHA: 'main' }, { RELEASE_PUBLISH_AT: 'tomorrow' }, { GH_TOKEN: '' },
  ]) {
    let called = false;
    await assert.rejects(dispatchTagRelease({ ...environment(), ...changes }, async () => { called = true; }));
    assert.equal(called, false);
  }
});

test('dispatch errors do not echo response bodies or credentials', async () => {
  await assert.rejects(dispatchTagRelease(environment(), async () => ({ ok: false, status: 403,
    text: () => { throw new Error('Do not read an arbitrary response body'); } })),
  { message: 'Tag release dispatch failed (HTTP 403)' });
});

test('workflow verifies the expected SHA before checkout and gates release execution to tag refs', () => {
  const workflow = fs.readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');
  assert.ok(workflow.indexOf('EXPECTED_RELEASE_SHA') < workflow.indexOf('uses: actions/checkout@'));
  assert.match(workflow, /"\$GITHUB_SHA" != "\$EXPECTED_RELEASE_SHA"/);
  assert.match(workflow, /validate:\s+#[^\n]*\n\s+if: github.ref_type == 'tag'/);
  assert.match(workflow, /Dispatch isolated tag release\n\s+if: github.ref_type != 'tag'/);
  assert.doesNotMatch(workflow, /ref: \$\{\{ needs\./);
  const guard = workflow.match(/Verify dispatched tag snapshot[\s\S]*?run: \|\n([\s\S]*?)\n      - uses:/)[1];
  for (const [expected, actual, status] of [['a'.repeat(40), 'b'.repeat(40), 1],
    ['a'.repeat(40), 'a'.repeat(40), 0], ['', 'a'.repeat(40), 0]]) {
    const result = spawnSync('bash', ['-e', '-c', guard], { env: { ...process.env,
      EXPECTED_RELEASE_SHA: expected, GITHUB_SHA: actual }, encoding: 'utf8' });
    assert.equal(result.status, status, result.stderr);
  }
});
