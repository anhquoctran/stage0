import assert from 'node:assert/strict';
import test from 'node:test';
import { releasePeriod, inReleasePeriod, assertPeriodClosed, assertReleaseDay } from './release-period.mjs';
import { planRollup, assertRollupPullRequest } from './release-rollup.mjs';
import { composeRollup, readRollup } from './release-rollup-tree.mjs';
import { InvalidReleaseCandidate } from './release-promotion-github.mjs';
import { assertPublishedPromotion } from './release-promotion.mjs';
import { sourceChanges } from './release-history.mjs';
import { rollupFixture } from './helpers/releaseRollupFixture.mjs';

const now = new Date('2026-11-27T00:30:00Z');
const options = f => ({ root: f.root, channel: 'beta', releaseDate: '2026-11-27', baseSha: f.baseSha, api: f.api, now });

test('monthly window is previous month day 28 through day 26, including leap/year boundaries', () => {
  assert.deepEqual(releasePeriod('beta', '2026-11-27'), { channel: 'beta', releaseDate: '2026-11-27',
    start: '2026-10-28T00:00:00.000Z', end: '2026-11-27T00:00:00.000Z', timeZone: 'UTC' });
  assert.equal(releasePeriod('beta', '2027-01-27').start, '2026-12-28T00:00:00.000Z');
  assert.equal(releasePeriod('beta', '2028-03-27').start, '2028-02-28T00:00:00.000Z');
  assert.throws(() => releasePeriod('beta', '2026-11-26'));
  assert.throws(() => releasePeriod('beta', '2026-02-30'));
  assert.throws(() => releasePeriod('beta', '2026-11-27T00:00:00Z'));
});

test('Stable accumulates the whole previous quarter; Dec 27 Beta belongs to Jan 1 Stable without a seven-day delay', () => {
  assert.equal(releasePeriod('stable', '2027-01-01').start, '2026-10-01T00:00:00.000Z');
  assert.equal(releasePeriod('stable', '2027-04-01').start, '2027-01-01T00:00:00.000Z');
  assert.equal(releasePeriod('stable', '2027-07-01').start, '2027-04-01T00:00:00.000Z');
  assert.equal(releasePeriod('stable', '2027-10-01').start, '2027-07-01T00:00:00.000Z');
  assert.throws(() => releasePeriod('stable', '2027-02-01'));
  assert.equal(inReleasePeriod({ published_at: '2026-12-27T00:00:00Z' }, releasePeriod('stable', '2027-01-01')), true);
});

test('cutoff is half-open and cannot freeze early or publish late', () => {
  const p = releasePeriod('beta', '2026-11-27');
  assert.equal(inReleasePeriod({ published_at: '2026-10-27T23:59:59.999Z' }, p), false);
  assert.equal(inReleasePeriod({ published_at: p.start }, p), true);
  assert.equal(inReleasePeriod({ published_at: '2026-11-26T23:59:59.999Z' }, p), true);
  assert.equal(inReleasePeriod({ published_at: p.end }, p), false);
  assert.equal(inReleasePeriod({ published_at: p.start, draft: true }, p), false);
  assert.throws(() => assertPeriodClosed(p, new Date('2026-11-26T23:59:59Z')));
  assert.doesNotThrow(() => assertReleaseDay(p, now));
  assert.throws(() => assertReleaseDay(p, new Date('2026-11-28T00:00:00Z')));
});

test('all period snapshots accumulate, overlapping commits deduplicate, independent older fixes survive and source ledger conflicts do not spill into code', t => {
  const f = rollupFixture(t), headBefore = f.git('rev-parse', 'HEAD');
  f.releases.push({ tag_name: 'v9.0.0-nightly', published_at: '2026-11-27T00:00:00Z' },
    { tag_name: 'channel-nightly', published_at: '2026-11-02T00:00:00Z' },
    { tag_name: 'v9.0.1-beta', published_at: '2026-11-02T00:00:00Z' });
  const manifest = planRollup(options(f));
  assert.equal(manifest.sources.length, 3); assert.equal(manifest.commits.length, 3);
  assert.equal(new Set(manifest.commits.map(c => c.sha)).size, 3);
  const composed = composeRollup(f.root, manifest);
  assert.equal(composed.changed, true);
  assert.equal(f.git('show', `${composed.sha}:feature`), 'fixed');
  assert.equal(f.git('show', `${composed.sha}:independent-fix`), 'independent');
  assert.deepEqual(readRollup(f.root, composed.sha), manifest);
  assert.equal(sourceChanges(f.root, composed.sha).filter(c => /Stage0 (rollup|accumulate)|chore\(release\): assemble/.test(c.subject)).length, 0);
  assert.deepEqual(composeRollup(f.root, manifest), composed, 'Reruns reproduce exact objects/head SHA');
  assert.equal(f.git('rev-parse', 'HEAD'), headBefore); assert.equal(f.git('status', '--porcelain'), '');
  for (const source of manifest.sources) f.git('merge-base', '--is-ancestor', source.sourceSha, composed.sha);
});

test('all three Beta builds accumulate into the next quarter Stable', t => {
  const f = rollupFixture(t, { channel: 'beta' });
  const manifest = planRollup({ ...options(f), channel: 'stable', releaseDate: '2027-01-01', now: new Date('2027-01-01T00:10:00Z') });
  assert.equal(manifest.sources.length, 3);
  const composed = composeRollup(f.root, manifest);
  assert.equal(f.git('show', `${composed.sha}:feature`), 'fixed');
  assert.equal(f.git('show', `${composed.sha}:independent-fix`), 'independent');
});

test('failed candidate evidence is recorded, while API/auth failures abort rather than silently dropping builds', t => {
  const f = rollupFixture(t);
  const plan = planRollup({ ...options(f), candidateFor: (_root, tag) => {
    if (tag === 'v0.0.3-nightly') throw new InvalidReleaseCandidate('failed matrix');
    const c = f.candidates.get(tag);
    return { tag, sha: c.sha, sourceSha: c.sourceSha, run: c.run, release: c.release };
  } });
  assert.equal(plan.sources.length, 2); assert.deepEqual(plan.skipped, [{ tag: 'v0.0.3-nightly', reason: 'failed matrix' }]);
  assert.throws(() => planRollup({ ...options(f), candidateFor: () => { throw new Error('API unavailable'); } }), /API unavailable/);
  assert.equal(planRollup({ ...options(f), releases: [] }), null);
});

test('a source/application conflict blocks instead of selecting ours or silently losing a fix', t => {
  const f = rollupFixture(t, { conflict: true });
  const manifest = planRollup(options(f));
  assert.throws(() => composeRollup(f.root, manifest), /Rollup conflict/);
});

test('policy recomputes the whole ledger/head; pruning a source build, moving a head/base or changing artifacts invalidates approval', t => {
  const f = rollupFixture(t), manifest = planRollup(options(f)), composed = composeRollup(f.root, manifest);
  const pr = { head: { ref: 'promotion/beta/2026-11-27', sha: composed.sha }, base: { sha: f.baseSha } };
  const result = assertRollupPullRequest(f.root, pr, 'beta', { api: f.api, now });
  assert.equal(result.manifest.sources.length, 3);
  assert.throws(() => assertRollupPullRequest(f.root, { ...pr, base: { sha: composed.sha } }, 'beta', { api: f.api, now }), /Target changed/);
  const bad = { ...manifest, sources: manifest.sources.slice(1) };
  const altered = composeRollup(f.root, bad);
  assert.throws(() => assertRollupPullRequest(f.root, { ...pr, head: { ...pr.head, sha: altered.sha } }, 'beta', { api: f.api, now }), /inventory/);
  const c = f.candidates.get('v0.0.2-nightly'); c.run.run_attempt++;
  assert.throws(() => assertRollupPullRequest(f.root, pr, 'beta', { api: f.api, now }), /inventory/);
});

test('later revert stays effective rather than being reapplied by an earlier build', t => {
  const f = rollupFixture(t);
  const c = f.candidates.get('v0.0.3-nightly');
  f.git('checkout', '--detach', c.sourceSha); f.git('revert', '--no-edit', c.sourceSha);
  const reverted = f.git('rev-parse', 'HEAD');
  const manifest = planRollup(options(f)); manifest.sources[1].sourceSha = reverted;
  const composed = composeRollup(f.root, manifest);
  assert.equal(f.git('show', `${composed.sha}:feature`), 'before fix');
});

test('a complete reviewed period authorizes only its current merged target, with no single-tag/QA bypass', t => {
  const f = rollupFixture(t), manifest = planRollup(options(f)), composed = composeRollup(f.root, manifest);
  f.git('checkout', 'beta'); f.git('merge', '--no-ff', composed.sha, '-m', 'Merge approved monthly rollup');
  const merged = f.git('rev-parse', 'HEAD'), repo = { full_name: 'anhquoctran/stage0' };
  const pr = { number: 60, merged: true, state: 'closed', merged_at: '2026-11-27T00:20:00Z', draft: false, merge_commit_sha: merged,
    user: { login: 'github-actions[bot]' }, head: { ref: 'promotion/beta/2026-11-27', sha: composed.sha, repo },
    base: { ref: 'beta', sha: merged, repo }, body: '- [x] Smoke-tested install/update, launch, diff and reviewer on supported platforms.\n'
      + '- [x] Reviewed changes and known issues; ready for this channel.',
  };
  const api = endpoint => {
    if (endpoint.includes('/pulls?')) return [pr];
    if (endpoint === 'pulls/60') return pr;
    if (endpoint.includes('/reviews?')) return [{ user: { login: 'maintainer', type: 'User' }, author_association: 'OWNER',
      state: 'APPROVED', commit_id: composed.sha, submitted_at: '2026-11-27T00:15:00Z' }];
    if (endpoint.includes('/statuses?')) return [{ context: 'Release promotion policy', state: 'success', creator: { login: 'github-actions[bot]' },
      created_at: '2026-11-27T00:14:00Z', target_url: 'https://github.com/anhquoctran/stage0/actions/runs/50' }];
    if (endpoint.startsWith('code-scanning/analyses?')) return ['actions', 'javascript-typescript', 'rust'].map(language => ({
      category: `/language:${language}`, commit_sha: merged, error: '', tool: { name: 'CodeQL' },
    }));
    if (endpoint.startsWith('code-scanning/alerts?')) return [];
    return f.api(endpoint);
  };
  const args = { root: f.root, channel: 'beta', sourceSha: merged, api, now };
  const result = assertPublishedPromotion(args);
  assert.equal(result.pr, 60); assert.equal(result.candidate.manifest.sources.length, 3);
  pr.body = ''; assert.throws(() => assertPublishedPromotion(args), /checklist/);
  pr.head.ref = 'promotion/beta/v0.0.4-nightly'; assert.throws(() => assertPublishedPromotion(args), /not one candidate tag/);
});

test('quarterly Stable assembly retains target-only hotfixes missing from every Beta snapshot', async t => {
  const fs = await import('node:fs');
  const f = rollupFixture(t, { channel: 'beta' });
  f.git('checkout', 'main');
  fs.writeFileSync(`${f.root}/README`, 'stable security hotfix');
  f.git('commit', '-am', 'hotfix: protect stable behavior');
  const baseSha = f.git('rev-parse', 'HEAD');
  const manifest = planRollup({ ...options(f), baseSha, channel: 'stable', releaseDate: '2027-01-01', now: new Date('2027-01-01T00:10:00Z') });
  const result = composeRollup(f.root, manifest);
  assert.equal(f.git('show', `${result.sha}:README`), 'stable security hotfix');
  assert.equal(f.git('show', `${result.sha}:feature`), 'fixed');
  f.git('merge-base', '--is-ancestor', baseSha, result.sha);
});
