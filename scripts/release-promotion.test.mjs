import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { assertCandidateBuild, releaseTargets, assertPromotionSecurity } from './release-promotion-github.mjs';
import { parsePromotionBranch, assertCandidateAge, assertPromotionTree, assertPublishedPromotion } from './release-promotion.mjs';
import { prepareManualRelease } from './manual-release.mjs';
import { prepareScheduledBranch } from './prepare-release.mjs';

export function candidateFixture() {
  const sha = 'a'.repeat(40), tag = 'v0.0.8-nightly';
  const asset = name => ({ name, size: 50, state: 'uploaded', updated_at: '2026-11-01T00:00:00Z' });
  const assets = [asset('latest.json'), asset('SHA256SUMS.txt')];
  for (const [target, extensions] of Object.entries(releaseTargets)) {
    for (const ext of extensions) {
      const name = `${target}-stage0${ext}`;
      assets.push(asset(name));
      if (ext !== '.dmg') assets.push(asset(`${name}.sig`));
    }
  }
  const release = { tag_name: tag, draft: false, prerelease: true, published_at: '2026-11-01T00:00:00Z', assets };
  const run = { id: 1, run_attempt: 1, run_number: 1, head_sha: sha, head_branch: tag, path: '.github/workflows/release.yml',
    conclusion: 'success', status: 'completed', updated_at: '2026-11-01T00:05:00Z' };
  const jobs = [{ name: 'validate', conclusion: 'success' }, { name: 'publish', conclusion: 'success' },
    ...Object.keys(releaseTargets).map(target => ({ name: `build (os, ${target}, args)`, conclusion: 'success' }))];
  return { release, tagSha: sha, runs: [run], jobsForRun: () => jobs, jobs };
}

test('only adjacent channel tags are valid frozen promotion refs', () => {
  assert.equal(parsePromotionBranch('promotion/beta/v0.0.8-nightly', 'beta'), 'v0.0.8-nightly');
  assert.equal(parsePromotionBranch('promotion/stable/v0.0.9-beta', 'stable'), 'v0.0.9-beta');
  for (const [branch, channel] of [['develop', 'beta'], ['promotion/stable/v0.0.8-nightly', 'stable'],
    ['promotion/beta/v0.0.1', 'beta'], ['promotion/nightly/v0.0.9-beta', 'nightly'],
    ['promotion/beta/v0.0.8-nightly/../../main', 'beta']]) assert.throws(() => parsePromotionBranch(branch, channel));
});

test('soak starts after the later of publication and completed successful build; future dates fail closed', () => {
  const evidence = assertCandidateBuild(candidateFixture());
  const candidate = { tag: 'v0.0.8-nightly', ...evidence };
  assert.throws(() => assertCandidateAge(candidate, 'beta', new Date('2026-11-02T00:04:59Z')), /24 hours/);
  assert.doesNotThrow(() => assertCandidateAge(candidate, 'beta', new Date('2026-11-02T00:05:00Z')));
  assert.throws(() => assertCandidateAge(candidate, 'stable', new Date('2026-11-07T00:05:00Z')), /168 hours/);
  assert.doesNotThrow(() => assertCandidateAge(candidate, 'stable', new Date('2026-11-08T00:05:00Z')));
  assert.throws(() => assertCandidateAge(candidate, 'beta', new Date('2026-10-31T00:00:00Z')));
});

test('a release title or generic successful CI cannot substitute for the exact complete signed matrix', async t => {
  const mutations = {
    draft: f => { f.release.draft = true; },
    'newer failed attempt': f => { f.runs.push({ ...f.runs[0], run_number: 2, conclusion: 'failure' }); },
    'newer pending attempt': f => { f.runs.push({ ...f.runs[0], run_number: 2, conclusion: null, status: 'in_progress' }); },
    'wrong tag SHA': f => { f.runs[0].head_sha = 'b'.repeat(40); },
    'main controller only': f => { f.runs[0].head_branch = 'main'; },
    'wrong workflow': f => { f.runs[0].path = '.github/workflows/other.yml'; },
    'failed publish': f => { f.jobs[1].conclusion = 'failure'; },
    'missing ARM build': f => { f.jobs.pop(); },
    'missing signature': f => { f.release.assets = f.release.assets.filter(a => !a.name.endsWith('.exe.sig')); },
    'missing mac DMG': f => { f.release.assets = f.release.assets.filter(a => !a.name.endsWith('.dmg')); },
    'replaced asset after successful run': f => { f.release.assets[0].updated_at = '2026-11-01T00:06:00Z'; },
    'empty package': f => { f.release.assets[2].size = 0; },
    'duplicate asset': f => { f.release.assets.push(f.release.assets[0]); },
  };
  for (const [name, mutate] of Object.entries(mutations)) await t.test(name, () => {
    const fixture = candidateFixture(); mutate(fixture); assert.throws(() => assertCandidateBuild(fixture));
  });
});

test('security requires exact PR-head analyses and blocks candidate alerts rather than unrelated main alerts', () => {
  const pr = { number: 10, head: { sha: 'a'.repeat(40) } };
  const analyses = ['actions', 'javascript-typescript', 'rust'].map(language => ({
    category: `/language:${language}`, commit_sha: pr.head.sha, error: '', tool: { name: 'CodeQL' },
  }));
  const api = endpoint => endpoint.startsWith('code-scanning/analyses?') ? analyses : [];
  assert.doesNotThrow(() => assertPromotionSecurity(pr, api));
  assert.throws(() => assertPromotionSecurity(pr, () => { throw new Error('Forbidden'); }), /Forbidden/);
  assert.throws(() => assertPromotionSecurity(pr, endpoint => endpoint.includes('/analyses?') ? analyses
    : [{ rule: { security_severity_level: 'high' } }]), /1 High/);
  analyses[0].commit_sha = 'b'.repeat(40);
  assert.throws(() => assertPromotionSecurity(pr, api), /current CodeQL actions/);
});

function gitFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stage0-promotion-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-b', 'main'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'test@example.test');
  fs.writeFileSync(path.join(root, 'app.txt'), 'original'); git('add', '.'); git('commit', '-m', 'Base');
  const base = git('rev-parse', 'HEAD');
  git('checkout', '-b', 'nightly'); fs.writeFileSync(path.join(root, 'app.txt'), 'tested candidate');
  git('commit', '-am', 'Candidate'); const source = git('rev-parse', 'HEAD');
  return { root, git, base, source };
}

test('a moving head, divergent target or conflict never becomes an untested promotion', t => {
  const f = gitFixture(t);
  assert.doesNotThrow(() => assertPromotionTree(f.root, f.base, f.source, f.source));
  assert.throws(() => assertPromotionTree(f.root, f.base, f.base, f.source), /moved/);
  f.git('checkout', 'main'); fs.writeFileSync(path.join(f.root, 'fix.txt'), 'target hotfix');
  f.git('add', '.'); f.git('commit', '-m', 'Unbackported target fix');
  assert.throws(() => assertPromotionTree(f.root, f.git('rev-parse', 'HEAD'), f.source, f.source));
  fs.writeFileSync(path.join(f.root, 'app.txt'), 'conflicting'); f.git('commit', '-am', 'Conflict');
  assert.throws(() => assertPromotionTree(f.root, f.git('rev-parse', 'HEAD'), f.source, f.source));
});

test('manual stable preparation fails before any tag or working tree mutation without approved promotion', t => {
  const f = gitFixture(t);
  const head = f.git('rev-parse', 'HEAD');
  assert.throws(() => prepareManualRelease({ root: f.root, runId: '11', sourceSha: head, releases: [],
    promotionGuard: args => assertPublishedPromotion({ ...args, api: () => [] }),
  }), /approved beta promotion PR/);
  assert.equal(f.git('tag', '--list'), ''); assert.equal(f.git('rev-parse', 'HEAD'), head);
});

test('scheduled promotion guard skips an uncertified Beta before tag allocation', t => {
  const f = gitFixture(t);
  f.git('branch', 'beta'); f.git('branch', 'develop'); f.git('remote', 'add', 'origin', f.root);
  const before = f.git('tag', '--list');
  const result = prepareScheduledBranch({ root: f.root, schedule: 'beta', releases: [], now: new Date(),
    promotionGuard: ({ channel }) => { throw new Error(`Blocked ${channel}`); },
  });
  assert.equal(result.skipped, true); assert.equal(result.shouldBuild, false);
  assert.match(result.reason, /Blocked beta/);
  assert.equal(f.git('tag', '--list'), before);
});

function approvedFixture(t) {
  const f = gitFixture(t), evidence = candidateFixture();
  f.git('remote', 'add', 'origin', f.root);
  fs.writeFileSync(path.join(f.root, 'RELEASE_NOTES.md'), 'Generated release notes');
  f.git('add', '.'); f.git('commit', '-m', 'chore: prepare v0.0.8-nightly', '-m',
    `Stage0-Release-Channel: nightly\nStage0-Source-Commit: ${f.source}`);
  const snapshot = f.git('rev-parse', 'HEAD'); f.git('tag', 'v0.0.8-nightly');
  f.git('checkout', 'main'); f.git('merge', '--no-ff', f.source, '-m', 'Merge approved promotion');
  const merged = f.git('rev-parse', 'HEAD'); f.git('branch', 'beta', merged);
  const repo = { full_name: 'anhquoctran/stage0' };
  const pr = { number: 10, draft: false, merged: true, merged_at: '2026-11-03T00:00:00Z', state: 'closed', merge_commit_sha: merged,
    user: { login: 'github-actions[bot]' }, head: { ref: 'promotion/beta/v0.0.8-nightly', sha: f.source, repo },
    base: { ref: 'beta', sha: merged, repo }, body: '- [x] Smoke-tested install/update, launch, diff and reviewer on supported platforms.\n'
      + '- [x] Reviewed changes and known issues; ready for this channel.',
  };
  const reviews = [{ user: { login: 'maintainer', type: 'User' }, state: 'APPROVED', commit_id: f.source,
    author_association: 'OWNER', submitted_at: '2026-11-02T01:00:00Z' }];
  const statuses = [{ context: 'Release promotion policy', state: 'success', creator: { login: 'github-actions[bot]' },
    target_url: 'https://github.com/anhquoctran/stage0/actions/runs/123', created_at: '2026-11-02T00:10:00Z' }];
  evidence.runs[0].head_sha = snapshot;
  const api = endpoint => {
    if (endpoint.startsWith('releases/tags/')) return evidence.release;
    if (endpoint.startsWith('actions/workflows/')) return [{ workflow_runs: evidence.runs }];
    if (endpoint.startsWith('actions/runs/')) return [{ jobs: evidence.jobs }];
    if (endpoint.startsWith('code-scanning/analyses?')) return ['actions', 'javascript-typescript', 'rust'].map(language => ({
      category: `/language:${language}`, commit_sha: endpoint.includes('refs%2Fheads%2F') ? pr.merge_commit_sha : pr.head.sha, error: '', tool: { name: 'CodeQL' },
    }));
    if (endpoint.startsWith('code-scanning/alerts?')) return [];
    if (endpoint.includes('/statuses?')) return statuses;
    if (endpoint.includes('/reviews?')) return reviews;
    if (endpoint.startsWith('commits/') && endpoint.includes('/pulls?')) return [pr];
    if (endpoint === 'pulls/10') return pr;
    throw new Error(`Unexpected API ${endpoint}`);
  };
  return { ...f, evidence, pr, reviews, statuses, api, merged };
}

test('approved frozen source authorizes Beta despite later PR base metadata; comments do not revoke approval', t => {
  const f = approvedFixture(t);
  f.reviews.push({ ...f.reviews[0], state: 'COMMENTED', submitted_at: '2026-11-02T02:00:00Z' });
  const result = assertPublishedPromotion({ root: f.root, channel: 'beta', sourceSha: f.merged, api: f.api, now: new Date('2026-11-05') });
  assert.equal(result.pr, 10); assert.equal(result.candidate.sourceSha, f.source);
  assert.equal(f.git('rev-parse', 'HEAD'), f.merged);
});

test('publication revalidation rejects missing/stale/self approvals, unchecked QA and stale/forged policy status', async t => {
  const mutations = {
    'no approval': f => { f.reviews.length = 0; },
    'old head approved': f => { f.reviews[0].commit_id = f.base; },
    'self approval': f => { f.pr.user.login = 'maintainer'; },
    'untrusted outsider': f => { f.reviews[0].author_association = 'NONE'; },
    'approval withdrawn': f => { f.reviews.push({ ...f.reviews[0], state: 'DISMISSED', submitted_at: '2026-11-02T02:00:00Z' }); },
    'unchecked smoke tests': f => { f.pr.body = ''; },
    'failed latest status': f => { f.statuses.unshift({ ...f.statuses[0], state: 'failure' }); },
    'forged status creator': f => { f.statuses[0].creator.login = 'maintainer'; },
    'approval after merge': f => { f.reviews[0].submitted_at = '2026-11-04T00:00:00Z'; },
    'superseded source': f => { f.git('branch', '-f', 'beta', f.base); },
    'head moved': f => { f.pr.head.sha = f.base; },
    'wrong merge method': f => { f.pr.merge_commit_sha = f.source; },
  };
  for (const [name, mutate] of Object.entries(mutations)) await t.test(name, t => {
    const f = approvedFixture(t); mutate(f);
    assert.throws(() => assertPublishedPromotion({ root: f.root, channel: 'beta', sourceSha: f.merged, api: f.api, now: new Date('2026-11-05') }));
  });
});

test('a candidate tag containing untested source changes cannot certify its source parent', t => {
  const f = approvedFixture(t);
  f.git('checkout', '--detach', 'v0.0.8-nightly');
  fs.writeFileSync(path.join(f.root, 'app.txt'), 'not the source parent'); f.git('commit', '-am', 'chore: prepare v0.0.8-nightly', '-m',
    `Stage0-Release-Channel: nightly\nStage0-Source-Commit: ${f.source}`);
  // A two-parent/provenance mismatch is rejected before API evidence is consulted.
  f.git('tag', '-f', 'v0.0.8-nightly');
  assert.throws(() => assertPublishedPromotion({ root: f.root, channel: 'beta', sourceSha: f.merged, api: f.api, now: new Date('2026-11-05') }));
});

test('trusted PR workflow posts success/failure to the exact head SHA, never the base SHA', t => {
  const f = approvedFixture(t);
  f.pr.base.sha = f.base; f.pr.state = 'open'; f.pr.merged = false;
  const bin = path.join(f.root, 'bin'); fs.mkdirSync(bin);
  const data = path.join(f.root, 'api.json'), log = path.join(f.root, 'requests.jsonl');
  const event = path.join(f.root, 'event.json'); fs.writeFileSync(event, '{"number":10}');
  const endpoints = ['pulls/10', 'releases/tags/v0.0.8-nightly',
    `actions/workflows/release.yml/runs?head_sha=${f.evidence.runs[0].head_sha}&per_page=100`,
    'actions/runs/1/attempts/1/jobs?per_page=100',
    'code-scanning/analyses?ref=refs%2Fpull%2F10%2Fhead&tool_name=CodeQL&per_page=100',
    'code-scanning/alerts?state=open&ref=refs%2Fpull%2F10%2Fhead&per_page=100'];
  const responses = Object.fromEntries(endpoints.map(endpoint => [endpoint, f.api(endpoint)]));
  // Mock already-paginated endpoints expose page objects; CLI gh supplies that wrapper.
  for (const endpoint of endpoints.filter(e => e.startsWith('actions/'))) responses[endpoint] = responses[endpoint][0];
  fs.writeFileSync(data, JSON.stringify(responses));
  fs.writeFileSync(path.join(bin, 'gh'), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2), endpoint = args[1].replace('repos/anhquoctran/stage0/', '');
if (args.includes('--method')) {
  const body = JSON.parse(fs.readFileSync(0, 'utf8'));
  fs.appendFileSync(process.env.FAKE_GH_LOG, JSON.stringify({endpoint, body}) + '\\n');
  process.stdout.write(JSON.stringify(endpoint === 'pulls' ? {number:10, html_url:'https://github.com/anhquoctran/stage0/pull/10'} : {}));
} else {
  const value = JSON.parse(fs.readFileSync(process.env.FAKE_GH_DATA, 'utf8'))[endpoint];
  if (value === undefined) throw new Error('Unexpected endpoint: ' + endpoint);
  process.stdout.write(JSON.stringify(args.includes('--paginate') ? [value] : value));
}
`, { mode: 0o755 });
  const env = { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, FAKE_GH_DATA: data, FAKE_GH_LOG: log,
    GITHUB_REPOSITORY: 'anhquoctran/stage0', GITHUB_EVENT_PATH: event, GITHUB_EVENT_NAME: 'pull_request_target',
    GITHUB_SHA: f.base, GITHUB_RUN_ID: '123',
  };
  const entry = new URL('./release-promotion-cli.mjs', import.meta.url);
  execFileSync(process.execPath, [entry.pathname, 'check-pr'], { cwd: f.root, env, stdio: 'pipe' });
  let requests = fs.readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse);
  assert.deepEqual(requests.map(r => r.body.state), ['pending', 'success']);
  assert.ok(requests.every(r => r.endpoint === `statuses/${f.source}`));
  assert.ok(requests.every(r => r.body.context === 'Release promotion policy'));
  responses['pulls/10'].body = ''; fs.writeFileSync(data, JSON.stringify(responses));
  assert.throws(() => execFileSync(process.execPath, [entry.pathname, 'check-pr'], { cwd: f.root, env, stdio: 'pipe' }), /checklist/);
  requests = fs.readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(requests.at(-1).body.state, 'failure');
  f.git('branch', '-f', 'beta', f.base);
  responses['pulls?state=open&base=beta&head=anhquoctran:promotion%2Fbeta%2Fv0.0.8-nightly'] = [];
  fs.writeFileSync(data, JSON.stringify(responses));
  execFileSync(process.execPath, [entry.pathname, 'create'], { cwd: f.root, stdio: 'pipe', env: { ...env,
    GITHUB_REF: 'refs/heads/main', PROMOTION_CHANNEL: 'beta', PROMOTION_TAG: 'v0.0.8-nightly',
  } });
  requests = fs.readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse);
  const writes = requests.filter(r => !r.endpoint.startsWith('statuses/'));
  assert.deepEqual(writes.map(r => r.endpoint), ['git/refs', 'pulls', 'actions/workflows/promotion-policy.yml/dispatches']);
  assert.equal(writes[0].body.sha, f.source);
  assert.equal(writes[1].body.base, 'beta');
  assert.equal(writes[1].body.head, 'promotion/beta/v0.0.8-nightly');
  assert.deepEqual(writes[2].body, { ref: 'main', inputs: { pr: '10' } });
});
