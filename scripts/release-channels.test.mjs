import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { policy, releaseChannel, compareSemver, channelCrons, resolveScheduledChannel,
  targetReleaseTime, dueReleaseChannels, nextReleaseVersion, scheduledVersion,
  scheduledReleasePlan, waitForReleaseWindow, branchRiskProfile, validateGitFlowBranch } from './release-channels.mjs';
import { prepareScheduledBranch } from './prepare-release.mjs';
import { setProjectVersion } from './bump-version.mjs';
import { verifyReleaseVersion, createUpdateManifest } from './release-artifacts.mjs';

test('Beta and Stable increase patch versions without reusing historical release numbers', () => {
  const tags = ['v0.1.12'];
  const versions = ['0.0.1', '0.0.2-beta', '0.0.3-beta', '0.0.4', '0.0.5-beta'];
  for (const expected of versions) {
    const actual = nextReleaseVersion(expected.endsWith('-beta') ? 'beta' : 'stable', tags);
    assert.equal(actual, expected); tags.push(`v${actual}`);
  }
  for (let i = 1; i < versions.length; i++) assert.equal(compareSemver(versions[i - 1], versions[i]), -1);
  assert.equal(nextReleaseVersion('stable', ['v0.0.60-nightly']), '0.0.61');
  assert.throws(() => nextReleaseVersion('nightly', tags));
});

test('only the monthly and quarterly UTC windows allocate scheduled releases', () => {
  const regular = new Date('2026-11-01T23:00:00Z');
  assert.equal(targetReleaseTime(regular).toISOString(), '2026-11-02T00:00:00.000Z');
  assert.deepEqual(dueReleaseChannels(regular), []);
  const monthly = new Date('2026-11-26T23:00:00Z');
  assert.deepEqual(dueReleaseChannels(monthly), ['beta']);
  assert.equal(scheduledVersion('beta', monthly, ['v0.0.26-nightly']), '0.0.27-beta');
  const quarterly = new Date('2026-12-31T23:00:00Z');
  assert.deepEqual(dueReleaseChannels(quarterly), ['stable']);
  assert.equal(scheduledVersion('stable', quarterly, ['v0.0.60-beta']), '0.0.61');
  assert.throws(() => scheduledVersion('nightly', regular));
  assert.throws(() => scheduledVersion('rc', regular));
  assert.throws(() => scheduledVersion('stable', new Date('invalid')));
});

test('source branches and schedules map exclusively to develop, beta and main', () => {
  assert.equal(policy.developmentBranch, 'origin/develop');
  assert.equal(policy.promotion.routes.beta.from, 'develop');
  assert.equal(policy.channels.beta.branch, 'origin/beta');
  assert.equal(policy.channels.stable.branch, 'origin/main');
  assert.equal(policy.channels.beta.cadence, 'monthly');
  assert.equal(policy.channels.beta.releaseDayOfMonth, 27);
  assert.equal(policy.channels.stable.cadence, 'quarterly');
  assert.equal(policy.channels.stable.releaseDayOfQuarter, 1);
  assert.equal(resolveScheduledChannel('0 0 27 * *'), 'beta');
  assert.equal(resolveScheduledChannel('0 0 1 1,4,7,10 *'), 'stable');
  for (const cron of ['0 23 * * *', '0 12 * * *']) assert.throws(() => resolveScheduledChannel(cron), /Unknown release schedule/);
  assert.deepEqual(scheduledReleasePlan('beta', new Date('2026-11-26T23:12:00Z'), ['v0.0.10-nightly']), {
    channel: 'beta', branch: 'origin/beta', developmentBranch: 'origin/develop',
    version: '0.0.11-beta', tag: 'v0.0.11-beta', publishAt: '2026-11-27T00:00:00.000Z', releaseDate: '2026-11-27',
  });
});

test('release publication window waits until the frozen time and rejects invalid lead times', async () => {
  const slept = [];
  const delay = await waitForReleaseWindow('2026-11-27T00:00:00.000Z', Date.parse('2026-11-26T23:38:15Z'), async ms => slept.push(ms));
  assert.equal(delay, (21 * 60 + 45) * 1000); assert.deepEqual(slept, [delay]);
  assert.equal(await waitForReleaseWindow('', Date.now(), async () => assert.fail('Unexpected sleep')), 0);
  assert.equal(await waitForReleaseWindow('2026-11-27T00:00:00Z', Date.parse('2026-11-27T00:00:02Z'), async () => assert.fail('Already past')), 0);
  await assert.rejects(() => waitForReleaseWindow('invalid-date'), /Invalid release publish time/);
  await assert.rejects(() => waitForReleaseWindow('2026-11-28T00:00:00Z', Date.parse('2026-11-26T23:00:00Z')), /maximum lead window/);
});

test('release vocabulary allows only short Beta or suffixless Stable', () => {
  assert.equal(releaseChannel('0.0.1'), 'stable'); assert.equal(releaseChannel('0.0.3-beta'), 'beta');
  for (const value of ['v0.0.1', '0.0.01', '0.0.1-stable', '0.0.1-rc.1', '0.0.2-beta.1',
    '0.0.2-nightly', '0.0.2-nightly.20261031.1']) assert.throws(() => releaseChannel(value));
});

function projectFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stage0-channel-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'backend'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '0.0.1' }));
  fs.writeFileSync(path.join(root, 'backend/tauri.conf.json'), JSON.stringify({ version: '0.0.1', bundle: { createUpdaterArtifacts: true }, plugins: { updater: { requireSignedVersion: true } } }));
  fs.writeFileSync(path.join(root, 'backend/Cargo.toml'), '[package]\nversion = "0.0.1"\n');
  fs.writeFileSync(path.join(root, 'backend/Cargo.lock'), '[[package]]\nname = "stage0"\nversion = "0.0.1"\n');
  fs.writeFileSync(path.join(root, 'RELEASE_NOTES.md'), '# Previous notes');
  fs.mkdirSync(path.join(root, 'website')); fs.writeFileSync(path.join(root, 'website/index.html'), 'v0.0.1');
  return root;
}

test('all supported releases round-trip package/config/Cargo and signed manifest gates', t => {
  const root = projectFixture(t);
  for (const version of ['0.0.1', '0.0.2-beta', '0.0.3']) {
    setProjectVersion(version, root); assert.equal(verifyReleaseVersion(root, `v${version}`), version);
    assert.throws(() => createUpdateManifest(root, version, ''), /exactly one linux/);
  }
});

test('the only scheduled workflow matches policy; publication retains explicit latest/prerelease rules', () => {
  const rollups = fs.readFileSync(new URL('../.github/workflows/promote-release.yml', import.meta.url), 'utf8');
  const crons = Object.keys(policy.channels).flatMap(channel => channelCrons(channel));
  for (const cron of crons) assert.ok(rollups.includes(`cron: '${cron}'`));
  assert.equal((rollups.match(/- cron:/g) || []).length, crons.length);
  assert.equal(fs.existsSync(new URL('../.github/workflows/scheduled-release.yml', import.meta.url)), false);
  const release = fs.readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');
  assert.match(release, /node scripts\/prepare-release\.mjs wait "\$RELEASE_PUBLISH_AT"/);
  assert.match(release, /--draft=false --prerelease --latest=false/);
  assert.match(release, /--draft=false --prerelease=false --latest/);
});

test('Beta/Stable preparation reuses immutable snapshots and never pushes protected branches or executes channel tooling', t => {
  const root = projectFixture(t);
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
  git('init', '-b', 'main'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.test');
  git('remote', 'add', 'origin', root); git('add', '.'); git('commit', '-m', 'main base');
  const main = git('rev-parse', 'HEAD');
  git('checkout', '-b', 'develop'); fs.mkdirSync(path.join(root, 'scripts'));
  fs.writeFileSync(path.join(root, 'scripts/prepare-release.mjs'), 'throw new Error("Untrusted channel tooling must not execute");');
  git('add', '.'); git('commit', '-m', 'fix: development change'); git('branch', 'beta');
  const beta = git('rev-parse', 'HEAD');
  const options = { root, promotionGuard: () => null, releases: [], onlyChannel: true };
  const first = prepareScheduledBranch({ ...options, schedule: 'beta', now: new Date('2026-11-27T00:10:00Z') });
  const retry = prepareScheduledBranch({ ...options, schedule: 'beta', now: new Date('2026-11-27T00:15:00Z') });
  assert.equal(first.tag, 'v0.0.2-beta'); assert.equal(retry.tag, first.tag); assert.equal(retry.reused, true);
  assert.equal(git('rev-parse', `${first.tag}^`), beta);
  assert.equal(JSON.parse(git('show', `${first.tag}:backend/about.json`)).releaseDate, '2026-11-27');
  const stable = prepareScheduledBranch({ ...options, schedule: 'stable', now: new Date('2027-01-01T00:10:00Z') });
  assert.equal(stable.tag, 'v0.0.3'); assert.equal(git('rev-parse', `${stable.tag}^`), main);
  assert.equal(JSON.parse(git('show', `${stable.tag}:backend/about.json`)).releaseDate, '2027-01-01');
  assert.equal(git('rev-parse', 'main'), main); assert.equal(git('rev-parse', 'beta'), beta);
  assert.equal(git('tag', '--list', '*nightly*'), '');
});

test('CI gate rejects every Nightly invocation and raw Stable pushes while permitting reviewed Beta/Stable entry points', () => {
  const workflow = fs.readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');
  const expression = workflow.match(/    if: >-\n([\s\S]*?)\n    runs-on:/)[1];
  const gate = new Function('github', 'inputs', 'contains', `return (${expression.trim()});`);
  const allowed = (event, tag, ref = `refs/tags/${tag}`, repository = 'anhquoctran/stage0') => gate({
    event_name: event, ref_name: tag, repository, ref, ref_type: ref.startsWith('refs/tags/') ? 'tag' : 'branch',
  }, { tag }, (value, part) => value.includes(part));
  for (const event of ['workflow_dispatch', 'schedule', 'workflow_call', 'push']) {
    assert.equal(allowed(event, 'v0.0.2-nightly'), false);
    assert.equal(allowed(event, 'v0.0.3-beta'), true);
    assert.equal(allowed(event, 'v0.0.4'), event !== 'push');
  }
  assert.equal(allowed('workflow_dispatch', 'v0.0.4', 'refs/heads/feat/untrusted'), false);
  assert.equal(allowed('workflow_dispatch', 'v0.0.4', 'refs/heads/main', 'other/repo'), false);
});

test('branch policy requires checked develop PRs and hotfix back-sync without the retired tier', () => {
  for (const branch of ['develop', 'feat/ui', 'fix/race']) assert.deepEqual(branchRiskProfile(branch), { risk: 'highest', stability: 'unstable' });
  assert.deepEqual(branchRiskProfile('origin/beta'), { risk: 'medium', stability: 'stabilizing' });
  assert.deepEqual(branchRiskProfile('origin/main'), { risk: 'low', stability: 'stable' });
  assert.throws(() => branchRiskProfile('nightly'));
  for (const branch of ['main', 'beta', 'develop', 'origin/main', 'refs/heads/develop']) {
    assert.throws(() => validateGitFlowBranch({ headBranch: branch }), /Direct commits or pushes/);
  }
  for (const branch of ['feat/ci', 'fix/updater', 'refactor/git', 'perf/diff', 'docs/git', 'test/channels', 'chore/deps']) {
    assert.equal(validateGitFlowBranch({ headBranch: branch }).prTarget, 'develop');
    assert.throws(() => validateGitFlowBranch({ headBranch: branch, baseBranch: 'main' }), /Standard work branches/);
  }
  assert.deepEqual(validateGitFlowBranch({ headBranch: 'hotfix/main/security', baseBranch: 'main' }).syncBranches, ['beta', 'develop']);
  assert.deepEqual(validateGitFlowBranch({ headBranch: 'hotfix/beta/crash', baseBranch: 'beta' }).syncBranches, ['develop']);
  for (const base of ['develop', 'nightly']) assert.throws(() => validateGitFlowBranch({ headBranch: 'hotfix/example', baseBranch: base }), /target main or beta/);
  assert.throws(() => validateGitFlowBranch({ headBranch: 'random' }), /Branch name must use/);
});

test('promotion branches identify a whole calendar batch with its exact target', () => {
  assert.equal(validateGitFlowBranch({ headBranch: 'promotion/beta/2026-11-27', baseBranch: 'beta' }).kind, 'promotion');
  assert.equal(validateGitFlowBranch({ headBranch: 'promotion/stable/2027-01-01', baseBranch: 'main' }).prTarget, 'main');
  assert.throws(() => validateGitFlowBranch({ headBranch: 'promotion/beta/v0.0.8-nightly', baseBranch: 'beta' }), /calendar period/);
  assert.throws(() => validateGitFlowBranch({ headBranch: 'promotion/beta/2026-11-26', baseBranch: 'beta' }), /day 27/);
  assert.throws(() => validateGitFlowBranch({ headBranch: 'promotion/stable/2027-01-01', baseBranch: 'beta' }), /configured branch/);
});
