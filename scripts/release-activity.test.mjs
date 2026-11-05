import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { previewBuildDecision, previousChannelRelease, publishedReleases, releaseSource } from './release-history.mjs';
import { createReleaseChangelog, writeReleaseChangelog } from './release-changelog.mjs';
import { prepareScheduledBranch } from './prepare-release.mjs';

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
  git('tag', 'v0.0.1-nightly');
  git('tag', 'v0.0.2-beta');
  git('tag', 'v0.0.3');
  return { root, dir, git, commit, base };
}

test('selects the last published release of the same channel, ignoring drafts, aliases and failed tags', () => {
  const releases = [published('v0.0.3'), published('channel-nightly', '2026-11-26T00:00:00Z'),
    published('v0.0.1-nightly'), { ...published('v0.0.4-nightly'), draft: true },
    published('v0.0.5-nightly', '2026-11-26T00:00:00Z'), published('v0.0.6-beta', '2026-11-26T01:00:00Z')];
  assert.equal(previousChannelRelease('nightly', releases), 'v0.0.5-nightly');
  assert.equal(previousChannelRelease('beta', releases), 'v0.0.6-beta');
  assert.equal(previousChannelRelease('stable', releases), 'v0.0.3');
  assert.equal(previousChannelRelease('nightly', releases, 'v0.0.5-nightly'), 'v0.0.1-nightly');
});

test('both preview channels skip old or already released source, but Stable keeps its cadence', t => {
  const f = fixture(t);
  for (const channel of ['nightly', 'beta']) {
    const decision = sourceSha => previewBuildDecision({ root: f.root, channel, sourceSha, releases: [], now });
    assert.equal(decision(f.base).shouldBuild, false);
    const recent = f.commit('fix: new source', '2026-11-26T22:00:00Z');
    assert.equal(decision(recent).shouldBuild, true);
    const tag = `v0.0.4-${channel}`;
    f.git('tag', tag);
    const releases = [published(tag)];
    assert.equal(previewBuildDecision({ root: f.root, channel, sourceSha: recent, releases, now }).shouldBuild, false);
    assert.equal(previewBuildDecision({ root: f.root, channel, sourceSha: recent, releases, tag, now }).shouldBuild, false);
    f.git('checkout', '--detach', f.base);
  }
  assert.equal(previewBuildDecision({ root: f.root, channel: 'stable', sourceSha: f.base, releases: [], now }).shouldBuild, true);
});

test('the rolling 24-hour window is inclusive, excludes future commits and walks non-monotonic dates', t => {
  const f = fixture(t);
  const decide = sourceSha => previewBuildDecision({ root: f.root, channel: 'nightly', sourceSha, releases: [], now }).shouldBuild;
  const old = f.commit('fix: outside window', '2026-11-25T22:59:59Z');
  assert.equal(decide(old), false);
  const boundary = f.commit('fix: exact cutoff', '2026-11-25T23:00:00Z');
  assert.equal(decide(boundary), true);
  const backdatedChild = f.commit('fix: older child', '2026-11-24T00:00:00Z');
  assert.equal(decide(backdatedChild), true, 'An old child must not hide a recent ancestor');
  f.git('checkout', '--detach', f.base);
  const future = f.commit('fix: future timestamp', '2026-11-26T23:00:01Z');
  assert.equal(decide(future), false);
});

test('recent generated snapshot timestamps cannot make stale source eligible', t => {
  const f = fixture(t);
  const snapshot = f.commit('chore: prepare v0.0.4-nightly', '2026-11-26T22:00:00Z',
    'Stage0-Release-Channel: nightly\nStage0-Release-Date: 2026-11-27');
  assert.equal(releaseSource(f.root, snapshot), f.base);
  assert.equal(previewBuildDecision({ root: f.root, channel: 'nightly', sourceSha: snapshot, releases: [], now }).shouldBuild, false);
});

test('failed tags and drafts do not consume source changes or remove changelog entries', t => {
  const f = fixture(t);
  const change = f.commit('fix: retain failed build changes', '2026-11-26T21:00:00Z');
  f.git('tag', 'v0.0.4-nightly');
  const releases = [published('v0.0.1-nightly'), { ...published('v0.0.4-nightly'), draft: true }];
  const decision = previewBuildDecision({ root: f.root, channel: 'nightly', sourceSha: change, releases, now });
  assert.equal(decision.shouldBuild, true);
  assert.equal(decision.previousTag, 'v0.0.1-nightly');
  const notes = createReleaseChangelog({ root: f.root, version: '0.0.5-nightly', sourceSha: change, previousTag: decision.previousTag });
  assert.match(notes, /retain failed build changes/);
  assert.doesNotMatch(notes, /original feature/);
});

test('consecutive sibling release snapshots produce different changelogs with only the new delta', t => {
  const f = fixture(t);
  const firstSource = f.commit('fix: first change', '2026-11-25T23:00:00Z');
  const first = f.commit('chore: prepare v0.0.4-nightly', '2026-11-26T00:00:00Z', 'Stage0-Release-Channel: nightly');
  f.git('tag', 'v0.0.4-nightly');
  const firstNotes = createReleaseChangelog({ root: f.root, version: '0.0.4-nightly', sourceSha: first,
    previousTag: 'v0.0.1-nightly' });
  f.git('checkout', '--detach', firstSource);
  const secondSource = f.commit('feat: second change', '2026-11-26T22:00:00Z');
  const secondNotes = createReleaseChangelog({ root: f.root, version: '0.0.5-nightly', sourceSha: secondSource,
    previousTag: 'v0.0.4-nightly' });
  assert.match(firstNotes, /first change/);
  assert.doesNotMatch(firstNotes, /second change|chore: prepare|original feature/);
  assert.match(secondNotes, /second change/);
  assert.doesNotMatch(secondNotes, /first change|chore: prepare|original feature/);
  assert.match(secondNotes, /Changes since \[v0\.0\.4-nightly\]/);
  assert.throws(() => createReleaseChangelog({ root: f.root, version: '0.0.5-beta', sourceSha: secondSource,
    previousTag: 'v0.0.4-nightly' }), /same channel/);
  const unchanged = createReleaseChangelog({ root: f.root, version: '0.0.5-nightly', sourceSha: firstSource,
    previousTag: 'v0.0.4-nightly' });
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

test('scheduled skip creates no release tags, including when another due preview channel is eligible', t => {
  const f = fixture(t);
  // Minimal project files needed only by the eligible Beta snapshot.
  for (const name of ['backend', 'website']) fs.mkdirSync(path.join(f.root, name));
  fs.writeFileSync(path.join(f.root, 'package.json'), JSON.stringify({ version: '0.0.1' }));
  fs.writeFileSync(path.join(f.root, 'backend/Cargo.toml'), '[package]\nversion = "0.0.1"\n');
  fs.writeFileSync(path.join(f.root, 'backend/Cargo.lock'), '[[package]]\nname = "stage0"\nversion = "0.0.1"\n');
  fs.writeFileSync(path.join(f.root, 'backend/tauri.conf.json'), JSON.stringify({ version: '0.0.1' }));
  fs.writeFileSync(path.join(f.root, 'RELEASE_NOTES.md'), '# Stale fixed notes');
  fs.writeFileSync(path.join(f.root, 'website/index.html'), '0.0.1');
  f.commit('chore: project fixture', '2026-11-24T23:00:00Z');
  f.git('branch', 'nightly');
  f.git('checkout', '-b', 'beta');
  f.commit('fix: beta only change', '2026-11-26T22:00:00Z');
  f.git('push', 'origin', 'main', 'nightly', 'beta', '--tags');
  const tagsBefore = f.git('tag');
  const skip = prepareScheduledBranch({ root: f.root, schedule: 'nightly', releases: [], now: new Date('2026-11-26T22:59:00Z') });
  assert.equal(skip.shouldBuild, false);
  assert.equal(skip.tag, '');
  assert.match(skip.reason, /24 hours/);
  assert.equal(f.git('tag'), tagsBefore);
  const beta = prepareScheduledBranch({ root: f.root, schedule: 'beta', releases: [published('v0.0.2-beta')], now });
  assert.equal(beta.shouldBuild, true);
  assert.equal(beta.tag, 'v0.0.4-beta', 'Skipped Nightly does not allocate a version');
  assert.match(f.git('show', `${beta.tag}:RELEASE_NOTES.md`), /beta only change/);
  assert.doesNotMatch(f.git('show', `${beta.tag}:RELEASE_NOTES.md`), /Stale fixed notes/);
  assert.equal(f.git('tag', '--list', '*nightly').split('\n').length, 1);
});

test('release history consumes all API pages and propagates API failure instead of treating it as no history', t => {
  const f = fixture(t);
  const bin = path.join(f.dir, 'bin');
  fs.mkdirSync(bin);
  const executable = path.join(bin, 'gh');
  fs.writeFileSync(executable, `#!/bin/sh\nprintf '%s' '${JSON.stringify([[published('v0.0.1-nightly')],
    [{ ...published('v0.0.2-beta'), draft: true }, published('v0.0.3')]])}'\n`, { mode: 0o755 });
  const oldPath = process.env.PATH;
  process.env.PATH = `${bin}${path.delimiter}${oldPath}`;
  t.after(() => { process.env.PATH = oldPath; });
  assert.deepEqual(publishedReleases(f.root).map(release => release.tag_name), ['v0.0.1-nightly', 'v0.0.3']);
  fs.writeFileSync(executable, '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  assert.throws(() => publishedReleases(f.root));
});

test('both workflow entry paths gate expensive jobs and carry one changelog baseline into bundles and publication', () => {
  const workflow = fs.readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');
  const schedule = fs.readFileSync(new URL('../.github/workflows/scheduled-release.yml', import.meta.url), 'utf8');
  const gate = workflow.match(/  validate:[\s\S]*?\n    if: ([^\n]+)/)[1];
  const evaluate = new Function('github', 'needs', `return (${gate})`);
  for (const shouldBuild of ['true', 'false', '']) {
    assert.equal(evaluate({ ref_type: 'tag' }, { prepare: { outputs: { should_build: shouldBuild } } }), shouldBuild === 'true');
  }
  assert.match(schedule, /if: needs.prepare.outputs.should_build == 'true'/);
  assert.equal((workflow.match(/RELEASE_PREVIOUS_TAG: \$\{\{ needs.prepare.outputs.previous_tag \}\}/g) || []).length, 2);
  assert.equal((workflow.match(/node scripts\/release-changelog.mjs "\$RELEASE_TAG" "\$RELEASE_SOURCE_SHA" "\$RELEASE_PREVIOUS_TAG"/g) || []).length, 2);
  assert.match(workflow, /gh release edit "\$RELEASE_TAG" --notes-file RELEASE_NOTES.md/);
});
