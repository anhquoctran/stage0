import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { policy, releaseChannel, resolveScheduledChannel, dueReleaseChannels, nextReleaseVersion } from './release-channels.mjs';
import { developmentInventory, fetchDevelopmentSource, fetchDevelopmentCandidate } from './release-development-source.mjs';
import { planRollup, assertRollupPullRequest } from './release-rollup.mjs';
import { composeRollup } from './release-rollup-tree.mjs';
import { seedRegressionFixture } from './helpers/regressionFixture.mjs';
import { dispatchTagRelease } from './dispatch-tag-release.mjs';

const now = new Date('2026-11-27T00:30:00Z');
const period = { start: '2026-10-28T00:00:00Z', end: '2026-11-27T00:00:00Z' };
const repo = { full_name: 'anhquoctran/stage0' };

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stage0-development-rollup-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
  git('init', '-b', 'develop'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.test');
  git('remote', 'add', 'origin', root);
  seedRegressionFixture(root);
  fs.writeFileSync(path.join(root, 'security-fix'), 'protected');
  git('add', '.'); git('commit', '-m', 'base'); const baseSha = git('rev-parse', 'HEAD'); git('branch', 'beta');
  const prs = [], runs = new Map(), jobs = new Map();
  for (const [number, date] of [[1, '2026-10-28T00:00:00Z'], [2, '2026-11-05T00:00:00Z'], [3, '2026-11-26T23:59:59Z']]) {
    git('checkout', '-b', `fix/${number}`, 'develop');
    fs.writeFileSync(path.join(root, `fix-${number}`), `fix ${number}`);
    git('add', '.'); git('commit', '-m', `fix: change ${number}`); const headSha = git('rev-parse', 'HEAD');
    git('checkout', 'develop'); git('merge', '--no-ff', headSha, '-m', `Merge PR #${number}`);
    const sha = git('rev-parse', 'HEAD');
    const pr = { number, state: 'closed', merged: true, merged_at: date, merge_commit_sha: sha,
      base: { ref: 'develop', repo }, head: { sha: headSha, ref: `fix/${number}`, repo } };
    prs.push(pr);
    for (const [workflow, names] of [
      ['regression.yml', ['Regression gate (ubuntu-22.04)', 'Regression gate (macos-latest)', 'Regression gate (windows-latest)']],
      ['policy-tests.yml', ['Release policy tests']],
    ]) {
      const id = number * 10 + (workflow === 'regression.yml' ? 1 : 2);
      runs.set(`${workflow}/${headSha}`, [{ id, run_number: id, run_attempt: 1, path: `.github/workflows/${workflow}`,
        head_sha: headSha, head_branch: `fix/${number}`, event: 'pull_request', pull_requests: [],
        display_title: `${workflow === 'regression.yml' ? 'Regression checks' : 'Release policy tests'} · PR #${number} · develop · ${headSha}`,
        conclusion: 'success', status: 'completed',
        updated_at: date }]);
      jobs.set(id, names.map(name => ({ name, conclusion: 'success' })));
    }
  }
  const requests = [];
  const api = endpoint => {
    requests.push(endpoint);
    if (endpoint.startsWith('pulls?state=closed')) return prs;
    if (/^pulls\/\d+$/.test(endpoint)) return prs.find(pr => pr.number === Number(endpoint.split('/')[1]));
    if (endpoint.startsWith('actions/workflows/')) {
      const workflow = endpoint.split('/')[2], sha = new URL(`https://fixture/${endpoint}`).searchParams.get('head_sha');
      return [{ workflow_runs: runs.get(`${workflow}/${sha}`) || [] }];
    }
    if (endpoint.startsWith('actions/runs/')) return [{ jobs: jobs.get(Number(endpoint.split('/')[2])) || [] }];
    throw new Error(`Unexpected API ${endpoint}`);
  };
  const args = { root, channel: 'beta', releaseDate: '2026-11-27', baseSha, now, api };
  return { root, git, baseSha, prs, runs, jobs, requests, api, args };
}

test('only Beta and Stable can ever be scheduled, tagged or dispatched', async () => {
  assert.deepEqual(Object.keys(policy.channels), ['beta', 'stable']);
  assert.equal(policy.promotion.routes.beta.from, 'develop');
  assert.deepEqual(policy.gitFlow.protectedBranches, ['main', 'beta', 'develop']);
  assert.throws(() => releaseChannel('0.0.99-nightly'));
  assert.throws(() => resolveScheduledChannel('nightly'));
  assert.throws(() => resolveScheduledChannel('0 23 * * *'));
  assert.deepEqual(dueReleaseChannels(new Date('2026-11-12T00:00:00Z')), []);
  assert.deepEqual(dueReleaseChannels(new Date('2026-11-27T00:00:00Z')), ['beta']);
  assert.deepEqual(dueReleaseChannels(new Date('2027-01-01T00:00:00Z')), ['stable']);
  assert.equal(nextReleaseVersion('beta', ['v0.0.99-nightly']), '0.0.100-beta', 'Retired tags still reserve version numbers');
  assert.throws(() => nextReleaseVersion('nightly', []));
  let requests = 0;
  await assert.rejects(dispatchTagRelease({ GITHUB_REPOSITORY: repo.full_name, GITHUB_REF: 'refs/heads/main',
    GITHUB_REF_TYPE: 'branch', RELEASE_TAG: 'v0.0.99-nightly', RELEASE_SNAPSHOT_SHA: 'a'.repeat(40), GH_TOKEN: 'fixture' },
  async () => { requests++; return { ok: true }; }));
  assert.equal(requests, 0);
  assert.equal(fs.existsSync(new URL('../.github/workflows/scheduled-release.yml', import.meta.url)), false);
  const workflow = fs.readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');
  assert.match(workflow, /!v\*-nightly\*/);
  assert.doesNotMatch(workflow, /if: needs.prepare.outputs.channel !=/);
});

test('Beta accumulates every eligible develop merge without any published preview builds', t => {
  const f = fixture(t), before = f.git('rev-parse', 'HEAD');
  const manifest = planRollup(f.args);
  assert.equal(manifest.sources.length, 3);
  for (const source of manifest.sources) {
    assert.match(source.tag, /^develop\/pr-\d+\/[a-f0-9]{40}$/);
    assert.equal(source.evidence.workflows.length, 2);
    assert.equal(source.evidence.testedHead, f.prs.find(pr => pr.number === source.evidence.pullRequest).head.sha);
  }
  const assembled = composeRollup(f.root, manifest);
  for (const number of [1, 2, 3]) assert.equal(f.git('show', `${assembled.sha}:fix-${number}`), `fix ${number}`);
  assert.equal(f.git('show', `${assembled.sha}:security-fix`), 'protected');
  assert.deepEqual(composeRollup(f.root, manifest), assembled);
  assert.equal(f.git('rev-parse', 'HEAD'), before); assert.equal(f.git('status', '--porcelain'), '');
  assert.ok(f.requests.every(request => !request.startsWith('releases')));
});

test('merge time determines period membership, and rewritten or unreachable source history fails closed', t => {
  const f = fixture(t);
  f.prs[0].merged_at = '2026-10-27T23:59:59Z';
  f.prs[2].merged_at = period.end;
  assert.deepEqual(developmentInventory(f.root, period, f.api).map(item => item.number), [2]);
  f.prs[1].merge_commit_sha = 'a'.repeat(40);
  assert.throws(() => developmentInventory(f.root, period, f.api), /no longer on develop/);
});

test('missing, cancelled, skipped, failed, stale and unrelated checks never certify development sources', t => {
  const f = fixture(t), inventory = developmentInventory(f.root, period, f.api), item = inventory[0];
  const run = f.runs.get(`regression.yml/${f.prs[0].head.sha}`)[0];
  const check = () => fetchDevelopmentSource(f.root, item.tag_name, f.api, { release: item, period });
  assert.doesNotThrow(check);
  for (const patch of [{ status: 'in_progress' }, { conclusion: 'failure' }, { conclusion: 'cancelled' },
    { conclusion: 'skipped' }, { head_sha: 'b'.repeat(40) }, { event: 'push' }, { display_title: 'Another PR or target' },
    { head_branch: 'another-branch' },
    { path: '.github/workflows/other.yml' }, { updated_at: period.end }, { updated_at: 'invalid' }]) {
    const original = { ...run }; Object.assign(run, patch);
    assert.throws(check); Object.assign(run, original);
  }
  const jobs = f.jobs.get(run.id), removed = jobs.pop(); assert.throws(check); jobs.push(removed);
  jobs[0].conclusion = 'skipped'; assert.throws(check); jobs[0].conclusion = 'success';
  const list = f.runs.get(`regression.yml/${f.prs[0].head.sha}`);
  list.push({ ...run, run_number: 999, run_attempt: 2, conclusion: 'failure' });
  assert.throws(check, /Latest exact-head/);
});

test('an altered merge tree cannot borrow CI from its PR head; API errors abort the complete batch', t => {
  const f = fixture(t), item = developmentInventory(f.root, period, f.api)[0];
  f.prs[0].head.sha = f.prs[1].head.sha;
  assert.throws(() => fetchDevelopmentSource(f.root, item.tag_name, f.api, { release: item, period }), /differs/);
  assert.throws(() => planRollup({ ...f.args, api: endpoint => {
    if (endpoint.startsWith('actions/')) throw new Error('API unavailable');
    return f.api(endpoint);
  } }), /API unavailable/);
});

test('failed source is audited and ledger revalidation detects reruns, omitted sources and a moved target', t => {
  const f = fixture(t), run = f.runs.get(`regression.yml/${f.prs[0].head.sha}`)[0];
  run.conclusion = 'failure';
  const rejected = planRollup(f.args);
  assert.equal(rejected.sources.length, 2); assert.equal(rejected.skipped.length, 1);
  assert.match(rejected.skipped[0].tag, /^develop\/pr-1\//);
  run.conclusion = 'success';
  const manifest = planRollup(f.args), composed = composeRollup(f.root, manifest);
  const pr = { head: { ref: 'promotion/beta/2026-11-27', sha: composed.sha }, base: { sha: f.baseSha } };
  const check = value => assertRollupPullRequest(f.root, value, 'beta', { api: f.api, now });
  assert.doesNotThrow(() => check(pr));
  assert.throws(() => check({ ...pr, base: { sha: composed.sha } }), /Target changed/);
  const pruned = composeRollup(f.root, { ...manifest, sources: manifest.sources.slice(1) });
  assert.throws(() => check({ ...pr, head: { ...pr.head, sha: pruned.sha } }), /inventory/);
  run.run_attempt++; f.jobs.set(run.id, f.jobs.get(run.id));
  assert.throws(() => check(pr), /inventory/);
});

test('Beta hotfix certification uses a reachable checked development snapshot, never a retired tag', t => {
  const f = fixture(t), source = developmentInventory(f.root, period, f.api)[0];
  const candidate = fetchDevelopmentCandidate(f.root, source.tag_name, f.api, now);
  assert.equal(candidate.sourceSha, source.sha); assert.ok(Number.isFinite(candidate.readySince));
  assert.throws(() => fetchDevelopmentCandidate(f.root, 'v0.0.9-nightly', f.api, now));
  assert.throws(() => fetchDevelopmentCandidate(f.root, `develop/pr-1/${'a'.repeat(40)}`, f.api, now), /no longer on develop/);
});

import { retireNightly, retiredTagRules } from './retire-nightly-release.mjs';

test('live retirement is idempotent, blocks retired tag creation/updates and never deletes historical releases or refs', () => {
  let stored, state = 'active'; const writes = [];
  const api = (endpoint, options = {}) => {
    if (options.method) {
      writes.push({ endpoint, ...options });
      if (endpoint === 'rulesets' || endpoint === 'rulesets/42') stored = { id: 42, ...options.body };
      if (endpoint.endsWith('/disable')) state = 'disabled_manually';
      return stored;
    }
    if (endpoint.startsWith('rulesets?')) return stored ? [stored] : [];
    if (endpoint === 'rulesets/42') return stored;
    if (endpoint === 'actions/workflows/scheduled-release.yml') return { state };
    throw new Error(endpoint);
  };
  assert.equal(retireNightly({ api }).applied, false); assert.equal(writes.length, 0);
  assert.equal(retireNightly({ api, apply: true }).rulesetId, 42);
  assert.equal(retireNightly({ api, apply: true }).rulesetId, 42);
  assert.deepEqual(writes.map(write => write.endpoint), ['rulesets', 'actions/workflows/scheduled-release.yml/disable',
    'rulesets/42']);
  assert.deepEqual(stored.rules, retiredTagRules.rules); assert.deepEqual(stored.bypass_actors, []);
  assert.equal(writes.some(write => write.method === 'DELETE'), false);
  stored.target = 'branch'; assert.throws(() => retireNightly({ api, apply: true }), /Unexpected/);
});
