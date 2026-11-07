import assert from 'node:assert/strict';
import test from 'node:test';
import { rollupFixture } from './helpers/releaseRollupFixture.mjs';
import { createRollupPullRequest } from './release-rollup-controller.mjs';
import { publishRollup } from './release-rollup-publish.mjs';
import { planRollup } from './release-rollup.mjs';
import { composeRollup } from './release-rollup-tree.mjs';
import { dispatchTagRelease } from './dispatch-tag-release.mjs';

const now = new Date('2026-11-27T00:30:00Z');

test('controller creates one frozen bot PR containing every eligible build and commit ledger; retry reuses it', t => {
  const f = rollupFixture(t), writes = [];
  let pr;
  const api = (endpoint, options = {}) => {
    if (endpoint.startsWith('pulls?')) return pr ? [pr] : [];
    if (options.method === 'POST') {
      writes.push({ endpoint, ...options });
      if (endpoint === 'pulls') return pr = { number: 50, html_url: 'https://github.com/anhquoctran/stage0/pull/50',
        head: { sha: f.git('rev-parse', 'refs/heads/promotion/beta/2026-11-27') } };
      return null;
    }
    return f.api(endpoint);
  };
  const args = { root: f.root, channel: 'beta', releaseDate: '2026-11-27', now, api };
  const first = createRollupPullRequest(args), second = createRollupPullRequest(args);
  assert.equal(first.sha, second.sha); assert.equal(first.manifest.sources.length, 3);
  assert.equal(writes.filter(w => w.endpoint === 'pulls').length, 1);
  assert.match(writes[0].body.body, /all 3 eligible nightly releases/);
  assert.match(writes[0].body.body, /Close and reopen/);
  assert.deepEqual(writes.at(-1).body, { ref: 'main', inputs: { pr: '50' } });
  assert.equal(f.git('rev-parse', 'refs/heads/beta'), f.baseSha, 'Never push protected target');
});

test('empty period creates no branch/PR/version', t => {
  const f = rollupFixture(t);
  const result = createRollupPullRequest({ root: f.root, channel: 'beta', releaseDate: '2026-11-27', now,
    api: endpoint => endpoint === 'releases?per_page=100' ? [] : f.api(endpoint) });
  assert.equal(result.skipped, true);
  assert.equal(f.git('branch', '--list', 'promotion/*'), '');
});

function approvedRollup(t) {
  const f = rollupFixture(t);
  const manifest = planRollup({ root: f.root, channel: 'beta', releaseDate: '2026-11-27', baseSha: f.baseSha, now, api: f.api });
  const composed = composeRollup(f.root, manifest);
  f.git('checkout', 'beta'); f.git('merge', '--no-ff', composed.sha, '-m', 'Approved calendar rollup');
  return { ...f, manifest, composed };
}

test('post-merge publication waits only for exact-commit CodeQL, freezes release date and dispatches tag-scoped native builds', async t => {
  const f = approvedRollup(t), prepared = [], dispatched = [], sleeps = [];
  let attempts = 0;
  const result = await publishRollup({ root: f.root,
    env: { GITHUB_REPOSITORY: 'anhquoctran/stage0', GITHUB_REF: 'refs/heads/beta' }, now: () => now,
    authorize: () => {}, security: () => { if (++attempts === 1) throw new Error('Successful current CodeQL rust analysis required'); },
    sleep: async ms => sleeps.push(ms), releasesFor: () => [],
    prepare: args => { prepared.push(args); return { shouldBuild: true, tag: 'v0.0.10-beta', sha: 'a'.repeat(40), publishAt: f.manifest.window.end }; },
    dispatch: async env => dispatched.push(env),
  });
  assert.equal(result.tag, 'v0.0.10-beta'); assert.deepEqual(sleeps, [30000]);
  assert.equal(prepared[0].onlyChannel, true); assert.equal(prepared[0].releaseDateOverride, '2026-11-27');
  assert.equal(dispatched[0].RELEASE_SNAPSHOT_SHA, 'a'.repeat(40));
});

test('security/approval failure never waits or dispatches; late/missing ledgers skip', async t => {
  const f = approvedRollup(t);
  const args = { root: f.root, env: { GITHUB_REPOSITORY: 'anhquoctran/stage0', GITHUB_REF: 'refs/heads/beta' }, now: () => now,
    authorize: () => {}, security: () => { throw new Error('High severity alert'); }, sleep: async () => assert.fail('Must not retry security failures'),
    dispatch: async () => assert.fail('Must not dispatch'),
  };
  await assert.rejects(publishRollup(args), /High severity/);
  assert.equal((await publishRollup({ ...args, now: () => new Date('2026-11-28') })).skipped, true);
  await assert.rejects(publishRollup({ ...args, env: { ...args.env, GITHUB_REF: 'refs/heads/develop' } }), /Only canonical/);
});

test('Beta controller can dispatch only Beta tags, and never stable/nightly or recursive tag runs', async () => {
  const env = { GITHUB_REPOSITORY: 'anhquoctran/stage0', GITHUB_REF: 'refs/heads/beta', GITHUB_REF_TYPE: 'branch',
    RELEASE_TAG: 'v0.0.10-beta', RELEASE_SNAPSHOT_SHA: 'a'.repeat(40), GH_TOKEN: 'fixture' };
  assert.equal((await dispatchTagRelease(env, async () => ({ ok: true }))).tag, env.RELEASE_TAG);
  for (const tag of ['v0.0.10', 'v0.0.10-nightly']) await assert.rejects(dispatchTagRelease({ ...env, RELEASE_TAG: tag }), /must run on main/);
  await assert.rejects(dispatchTagRelease({ ...env, GITHUB_REF_TYPE: 'tag' }), /must run on main/);
});

test('a published period source is never rebuilt and code-only source mutations are absent', async t => {
  const f = approvedRollup(t), source = f.git('rev-parse', 'HEAD'); f.git('tag', 'v0.0.20-beta');
  const result = await publishRollup({ root: f.root,
    env: { GITHUB_REPOSITORY: 'anhquoctran/stage0', GITHUB_REF: 'refs/heads/beta' }, now: () => now,
    authorize: () => {}, security: () => {}, releasesFor: () => [{ tag_name: 'v0.0.20-beta', draft: false, published_at: now.toISOString() }],
    prepare: () => assert.fail('Do not allocate another version'), dispatch: async () => assert.fail('Do not rebuild'),
  });
  assert.equal(result.skipped, true); assert.match(result.reason, /already been published/);
  assert.equal(f.git('rev-parse', 'HEAD'), source); assert.equal(f.git('status', '--porcelain'), '');
});
