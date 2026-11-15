import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { previewBuildDecision, previousChannelRelease, releaseSource } from './release-history.mjs';
import { createReleaseChangelog, writeReleaseChangelog } from './release-changelog.mjs';
import { prepareScheduledBranch } from './prepare-release.mjs';
import { commandFixture } from './helpers/commandFixture.mjs';

const now = new Date('2026-11-26T23:00:00Z');
const published = (tag, date = '2026-11-25T00:00:00Z') => ({ tag_name: tag, published_at: date, draft: false });

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stage0-release-activity-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const root = path.join(dir, 'source'), origin = path.join(dir, 'origin.git');
  fs.mkdirSync(root);
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '--bare', origin);
  git('init', '-b', 'main');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.test');
  git('remote', 'add', 'origin', origin);
  const commit = (subject, date, body = '') => {
    fs.writeFileSync(path.join(root, 'source.txt'), `${subject}\n${date}\n`);
    git('add', '.');
    execFileSync('git', ['commit', '-m', subject, '-m', body], { cwd: root, stdio: 'pipe',
      env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } });
    return git('rev-parse', 'HEAD');
  };
  const base = commit('feat: original feature', '2026-11-24T22:00:00Z');
  git('tag', 'v0.0.1-beta');
  git('tag', 'v0.0.2-beta');
  git('tag', 'v0.0.3');
  return { root, dir, git, commit, base };
}

test('selects the last published release of the same channel, ignoring drafts, aliases and failed tags', () => {
  const releases = [published('v0.0.3'), published('channel-beta', '2026-11-26T00:00:00Z'),
    published('v0.0.1-beta'), { ...published('v0.0.4-beta'), draft: true },
    published('v0.0.5-beta', '2026-11-26T00:00:00Z'), published('v0.0.6-beta', '2026-11-26T01:00:00Z')];
  assert.equal(previousChannelRelease('beta', releases), 'v0.0.6-beta');
  assert.equal(previousChannelRelease('beta', releases), 'v0.0.6-beta');
  assert.equal(previousChannelRelease('stable', releases), 'v0.0.3');
  assert.equal(previousChannelRelease('beta', releases, 'v0.0.6-beta'), 'v0.0.5-beta');
});

test('retired channels cannot make a build decision while Stable keeps its cadence', t => {
  const f = fixture(t);
  assert.throws(() => previewBuildDecision({ root: f.root, channel: 'nightly', sourceSha: f.base, releases: [], now }), /Unknown release channel/);
  assert.equal(previewBuildDecision({ root: f.root, channel: 'stable', sourceSha: f.base, releases: [], now }).shouldBuild, true);
});

test('Beta retains month-old unreleased changes without requiring activity in the last 24h', t => {
  const f = fixture(t);
  assert.equal(previewBuildDecision({ root: f.root, channel: 'beta', sourceSha: f.base, releases: [], now }).shouldBuild, true);
  assert.equal(previewBuildDecision({ root: f.root, channel: 'beta', sourceSha: f.base, releases: [published('v0.0.2-beta')], now }).shouldBuild, false);
});

test('Beta uses source differences rather than a retired daily activity window', t => {
  const f = fixture(t);
  const old = f.commit('fix: old unreleased change', '2026-10-29T00:00:00Z');
  assert.equal(previewBuildDecision({ root: f.root, channel: 'beta', sourceSha: old, releases: [published('v0.0.2-beta')], now }).shouldBuild, true);
});

test('recent generated snapshot timestamps cannot make stale source eligible', t => {
  const f = fixture(t);
  const snapshot = f.commit('chore: prepare v0.0.4-beta', '2026-11-26T22:00:00Z',
    'Stage0-Release-Channel: beta\nStage0-Release-Date: 2026-11-27');
  assert.equal(releaseSource(f.root, snapshot), f.base);
  assert.equal(previewBuildDecision({ root: f.root, channel: 'beta', sourceSha: snapshot, releases: [published('v0.0.2-beta')], now }).shouldBuild, false);
});

test('failed tags and drafts do not consume source changes or remove changelog entries', t => {
  const f = fixture(t);
  const change = f.commit('fix: retain failed build changes', '2026-11-26T21:00:00Z');
  f.git('tag', 'v0.0.4-beta');
  const releases = [published('v0.0.1-beta'), { ...published('v0.0.4-beta'), draft: true }];
  const decision = previewBuildDecision({ root: f.root, channel: 'beta', sourceSha: change, releases, now });
  assert.equal(decision.shouldBuild, true);
  assert.equal(decision.previousTag, 'v0.0.1-beta');
  const notes = createReleaseChangelog({ root: f.root, version: '0.0.5-beta', sourceSha: change, previousTag: decision.previousTag });
  assert.match(notes, /retain failed build changes/);
  assert.doesNotMatch(notes, /original feature/);
});

test('consecutive sibling release snapshots produce different changelogs with only the new delta', t => {
  const f = fixture(t);
  const firstSource = f.commit('fix: first change', '2026-11-25T23:00:00Z');
  const first = f.commit('chore: prepare v0.0.4-beta', '2026-11-26T00:00:00Z', 'Stage0-Release-Channel: beta');
  f.git('tag', 'v0.0.4-beta');
  const firstNotes = createReleaseChangelog({ root: f.root, version: '0.0.4-beta', sourceSha: first,
    previousTag: 'v0.0.1-beta' });
  f.git('checkout', '--detach', firstSource);
  const secondSource = f.commit('feat: second change', '2026-11-26T22:00:00Z');
  const secondNotes = createReleaseChangelog({ root: f.root, version: '0.0.5-beta', sourceSha: secondSource,
    previousTag: 'v0.0.4-beta' });
  assert.match(firstNotes, /first change/);
  assert.doesNotMatch(firstNotes, /second change|chore: prepare|original feature/);
  assert.match(secondNotes, /second change/);
  assert.doesNotMatch(secondNotes, /first change|chore: prepare|original feature/);
  assert.match(secondNotes, /Changes since \[v0\.0\.4-beta\]/);
  assert.throws(() => createReleaseChangelog({ root: f.root, version: '0.0.5', sourceSha: secondSource,
    previousTag: 'v0.0.4-beta' }), /same channel/);
  const unchanged = createReleaseChangelog({ root: f.root, version: '0.0.5-beta', sourceSha: firstSource,
    previousTag: 'v0.0.4-beta' });
  assert.match(unchanged, /No source changes/);
});

test('first release explicitly describes its source history, escapes subjects, and embeds the exact notes', async t => {
  const f = fixture(t);
  const source = f.commit('fix: <img src=x> [click](javascript:alert) `code` ${literal}', '2026-11-26T22:00:00Z');
  const notes = createReleaseChangelog({ root: f.root, version: '0.0.4-beta', sourceSha: source });
  assert.match(notes, /First beta release/);
  assert.match(notes, /original feature/);
  assert.doesNotMatch(notes, /<img|\[click\]\(javascript:/);
  writeReleaseChangelog(f.root, notes);
  const embedded = fs.readFileSync(path.join(f.root, 'frontend/features/about/config/releaseNotes.ts'), 'utf8');
  const { DEFAULT_RELEASE_NOTES } = await import(`data:text/javascript,${encodeURIComponent(embedded)}`);
  assert.equal(DEFAULT_RELEASE_NOTES, notes);
  assert.equal(fs.readFileSync(path.join(f.root, 'RELEASE_NOTES.md'), 'utf8'), notes);
});

test('retired schedule creates no tags or working tree mutations', t => {
  const f = fixture(t), before = f.git('tag');
  assert.throws(() => prepareScheduledBranch({ root: f.root, schedule: 'nightly', releases: [], now }), /Unknown release schedule/);
  assert.equal(f.git('tag'), before); assert.equal(f.git('status', '--porcelain'), '');
});

test('release history consumes all API pages and propagates API failure instead of treating it as no history', t => {
  const f = fixture(t);
  const data = path.join(f.dir, 'api.json');
  fs.writeFileSync(data, JSON.stringify([[published('v0.0.1-beta')],
    [{ ...published('v0.0.2-beta'), draft: true }, published('v0.0.3')]]));
  const mock = commandFixture(f.dir, 'gh', () => {
    const data = fs.readFileSync(process.env.FAKE_GH_DATA, 'utf8');
    if (data === 'failure') throw new Error('API failed');
    return data;
  });
  const module = new URL('./release-history.mjs', import.meta.url).href;
  const readHistory = () => JSON.parse(execFileSync(process.execPath, [...mock, '--input-type=module', '--eval',
    `import { publishedReleases } from ${JSON.stringify(module)}; console.log(JSON.stringify(publishedReleases(process.cwd())));`],
  { cwd: f.root, encoding: 'utf8', stdio: 'pipe', env: { ...process.env, FAKE_GH_DATA: data } }));
  assert.deepEqual(readHistory().map(release => release.tag_name), ['v0.0.1-beta', 'v0.0.3']);
  fs.writeFileSync(data, 'failure');
  assert.throws(readHistory, /API failed/);
});

test('both workflow entry paths gate expensive jobs and carry one changelog baseline into bundles and publication', () => {
  const workflow = fs.readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');
  assert.equal(fs.existsSync(new URL('../.github/workflows/scheduled-release.yml', import.meta.url)), false);
  const gate = workflow.match(/  validate:[\s\S]*?\n    if: ([^\n]+)/)[1];
  const evaluate = new Function('github', 'needs', `return (${gate})`);
  for (const shouldBuild of ['true', 'false', '']) {
    assert.equal(evaluate({ ref_type: 'tag' }, { prepare: { outputs: { should_build: shouldBuild } } }), shouldBuild === 'true');
  }
  assert.equal((workflow.match(/RELEASE_PREVIOUS_TAG: \$\{\{ needs.prepare.outputs.previous_tag \}\}/g) || []).length, 2);
  assert.equal((workflow.match(/node scripts\/release-changelog.mjs "\$RELEASE_TAG" "\$RELEASE_SOURCE_SHA" "\$RELEASE_PREVIOUS_TAG"/g) || []).length, 2);
  assert.match(workflow, /gh release edit "\$RELEASE_TAG" --notes-file RELEASE_NOTES.md/);
});
