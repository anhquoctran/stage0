import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  policy,
  releaseChannel,
  compareSemver,
  channelCrons,
  resolveScheduledChannel,
  targetReleaseTime,
  dueReleaseChannels,
  nextReleaseVersion,
  scheduledVersion,
  scheduledReleasePlan,
  waitForReleaseWindow,
  branchRiskProfile,
  validateGitFlowBranch,
} from './release-channels.mjs';
import { prepareScheduledBranch } from './prepare-release.mjs';
import { setProjectVersion } from './bump-version.mjs';
import { verifyReleaseVersion, createUpdateManifest } from './release-artifacts.mjs';

test('chronological releases produce strictly increasing SemVer with short -nightly/-beta suffixes and no suffix for stable', () => {
  const tags = ['v0.1.12']; // Legacy 0.1.x line is ignored
  const v1 = nextReleaseVersion('stable', tags);
  assert.equal(v1, '0.0.1');
  tags.push(`v${v1}`);

  const v2 = nextReleaseVersion('nightly', tags);
  assert.equal(v2, '0.0.2-nightly');
  tags.push(`v${v2}`);

  const v3 = nextReleaseVersion('nightly', tags);
  assert.equal(v3, '0.0.3-nightly');
  tags.push(`v${v3}`);

  const v4 = nextReleaseVersion('beta', tags);
  assert.equal(v4, '0.0.4-beta');
  tags.push(`v${v4}`);

  const v5 = nextReleaseVersion('nightly', tags);
  assert.equal(v5, '0.0.5-nightly');
  tags.push(`v${v5}`);

  const v6 = nextReleaseVersion('stable', tags);
  assert.equal(v6, '0.0.6');
  tags.push(`v${v6}`);

  const sequence = [v1, v2, v3, v4, v5, v6];
  for (let index = 1; index < sequence.length; index++) {
    assert.equal(
      compareSemver(sequence[index - 1], sequence[index]),
      -1,
      `Expected ${sequence[index - 1]} < ${sequence[index]}`,
    );
  }
});

test('overlapping 00:00 UTC release windows assign Nightly first, then Beta or Stable with a higher SemVer', () => {
  // Regular day (2026-11-02T00:00:00Z, pre-build at 2026-11-01T23:00:00Z): only nightly
  const regularPrebuild = new Date('2026-11-01T23:00:00Z');
  assert.equal(targetReleaseTime(regularPrebuild).toISOString(), '2026-11-02T00:00:00.000Z');
  assert.deepEqual(dueReleaseChannels(regularPrebuild), ['nightly']);
  assert.equal(scheduledVersion('nightly', regularPrebuild, ['v0.0.1']), '0.0.2-nightly');

  // Monthly 27th (2026-11-27T00:00:00Z, pre-build at 2026-11-26T23:00:00Z): nightly then beta
  const betaPrebuild = new Date('2026-11-26T23:00:00Z');
  assert.equal(targetReleaseTime(betaPrebuild).toISOString(), '2026-11-27T00:00:00.000Z');
  assert.deepEqual(dueReleaseChannels(betaPrebuild), ['nightly', 'beta']);
  const nightlyOn27 = scheduledVersion('nightly', betaPrebuild, ['v0.0.26-nightly']);
  const betaOn27 = scheduledVersion('beta', betaPrebuild, ['v0.0.26-nightly']);
  assert.equal(nightlyOn27, '0.0.27-nightly');
  assert.equal(betaOn27, '0.0.28-beta');
  assert.equal(compareSemver(nightlyOn27, betaOn27), -1);

  // Quarterly 1st of month (2027-01-01T00:00:00Z, pre-build at 2026-12-31T23:00:00Z): nightly then stable
  const quarterPrebuild = new Date('2026-12-31T23:00:00Z');
  assert.equal(targetReleaseTime(quarterPrebuild).toISOString(), '2027-01-01T00:00:00.000Z');
  assert.deepEqual(dueReleaseChannels(quarterPrebuild), ['nightly', 'stable']);
  const nightlyOnQ1 = scheduledVersion('nightly', quarterPrebuild, ['v0.0.60-nightly']);
  const stableOnQ1 = scheduledVersion('stable', quarterPrebuild, ['v0.0.60-nightly']);
  assert.equal(nightlyOnQ1, '0.0.61-nightly');
  assert.equal(stableOnQ1, '0.0.62');
  assert.equal(compareSemver(nightlyOnQ1, stableOnQ1), -1);

  assert.throws(() => scheduledVersion('rc', regularPrebuild));
  assert.throws(() => scheduledVersion('stable', new Date('invalid')));
});

test('source branches and cron schedules map to origin/nightly, origin/beta, origin/main and origin/develop', () => {
  assert.equal(policy.developmentBranch, 'origin/develop');
  assert.equal(policy.channels.nightly.branch, 'origin/nightly');
  assert.equal(policy.channels.beta.branch, 'origin/beta');
  assert.equal(policy.channels.stable.branch, 'origin/main');
  assert.equal(policy.channels.nightly.cadence, 'daily');
  assert.equal(policy.channels.beta.cadence, 'monthly');
  assert.equal(policy.channels.beta.releaseDayOfMonth, 27);
  assert.equal(policy.channels.stable.cadence, 'quarterly');
  assert.equal(policy.channels.stable.releaseDayOfQuarter, 1);

  assert.equal(resolveScheduledChannel('0 23 * * *'), 'nightly');
  assert.equal(resolveScheduledChannel('0 0 27 * *'), 'beta');
  assert.equal(resolveScheduledChannel('0 0 1 1,4,7,10 *'), 'stable');
  assert.throws(() => resolveScheduledChannel('0 12 * * *'), /Unknown release schedule/);

  const plan = scheduledReleasePlan('0 0 27 * *', new Date('2026-11-26T23:12:00Z'), ['v0.0.10-nightly']);
  assert.deepEqual(plan, {
    channel: 'beta',
    branch: 'origin/beta',
    developmentBranch: 'origin/develop',
    version: '0.0.12-beta',
    tag: 'v0.0.12-beta',
    publishAt: '2026-11-27T00:00:00.000Z',
    releaseDate: '2026-11-27',
  });
});

test('release publication window waits until exact 00:00 UTC and rejects invalid lead times', async () => {
  const slept = [];
  const delay = await waitForReleaseWindow(
    '2026-11-27T00:00:00.000Z',
    Date.parse('2026-11-26T23:38:15.000Z'),
    async ms => { slept.push(ms); },
  );
  assert.equal(delay, (21 * 60 + 45) * 1000);
  assert.deepEqual(slept, [(21 * 60 + 45) * 1000]);

  assert.equal(await waitForReleaseWindow('', Date.now(), async () => { assert.fail('Should not sleep'); }), 0);
  assert.equal(
    await waitForReleaseWindow('2026-11-27T00:00:00.000Z', Date.parse('2026-11-27T00:00:02.000Z'), async () => { assert.fail('Already past'); }),
    0,
  );
  await assert.rejects(() => waitForReleaseWindow('invalid-date'), /Invalid release publish time/);
  await assert.rejects(
    () => waitForReleaseWindow('2026-11-28T00:00:00.000Z', Date.parse('2026-11-26T23:00:00.000Z')),
    /exceeds maximum lead window/,
  );
});

test('release vocabulary accepts only short -nightly/-beta suffixes or suffixless stable versions', () => {
  for (const [version, expected] of [['0.0.1', 'stable'], ['0.0.2-nightly', 'nightly'], ['0.0.3-beta', 'beta']]) {
    assert.equal(releaseChannel(version), expected);
  }
  for (const version of ['v0.0.1', '0.0.01', '0.0.1-stable', '0.0.1-rc.1', '0.0.2-beta.1', '0.0.2-nightly.20261031.1']) {
    assert.throws(() => releaseChannel(version));
  }
});

test('all release channels round-trip package/config/Cargo and signed-version manifest gates', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stage0-channel-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'backend'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '0.0.1' }));
  fs.writeFileSync(path.join(root, 'backend/tauri.conf.json'), JSON.stringify({ version: '0.0.1', bundle: { createUpdaterArtifacts: true }, plugins: { updater: { requireSignedVersion: true } } }));
  fs.writeFileSync(path.join(root, 'backend/Cargo.toml'), '[package]\nversion = "0.0.1"\n');
  fs.writeFileSync(path.join(root, 'backend/Cargo.lock'), '[[package]]\nname = "stage0"\nversion = "0.0.1"\n');
  for (const version of ['0.0.1', '0.0.2-nightly', '0.0.3-beta']) {
    setProjectVersion(version, root);
    assert.equal(verifyReleaseVersion(root, `v${version}`), version);
    assert.throws(() => createUpdateManifest(root, version, ''), /exactly one linux/);
  }
});

test('workflow cron matches the canonical policy and holds publication until 00:00 UTC', () => {
  const schedule = fs.readFileSync(new URL('../.github/workflows/scheduled-release.yml', import.meta.url), 'utf8');
  const rollups = fs.readFileSync(new URL('../.github/workflows/promote-release.yml', import.meta.url), 'utf8');
  const allCrons = Object.keys(policy.channels).flatMap(channel => channelCrons(channel));
  for (const cron of allCrons) {
    assert.ok((schedule + rollups).includes(`cron: '${cron}'`), `Missing cron ${cron}`);
  }
  assert.equal(((schedule + rollups).match(/- cron:/g) || []).length, allCrons.length);
  assert.match(schedule, /node scripts\/prepare-release\.mjs prepare "\$RELEASE_SCHEDULE"/);
  assert.match(schedule, /publish_at: \$\{\{ needs\.prepare\.outputs\.publish_at \}\}/);

  const release = fs.readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');
  assert.match(release, /node scripts\/prepare-release\.mjs wait "\$RELEASE_PUBLISH_AT"/);
  assert.match(release, /--draft=false --prerelease --latest=false/);
  assert.match(release, /--draft=false --prerelease=false --latest/);
});

test('scheduled preparation checks out origin/nightly, origin/beta and origin/main in deterministic ascending order regardless of cron trigger order', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stage0-branch-schedule-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const origin = path.join(dir, 'origin.git'), root = path.join(dir, 'source');
  fs.mkdirSync(root);
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_AUTHOR_DATE: '2026-11-01T22:00:00Z', GIT_COMMITTER_DATE: '2026-11-01T22:00:00Z' } }).trim();
  git('init', '--bare', origin);
  git('init', '-b', 'main');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.test');
  git('remote', 'add', 'origin', origin);
  for (const sub of ['scripts', 'shared', 'backend', 'website']) fs.mkdirSync(path.join(root, sub));
  for (const name of ['prepare-release.mjs', 'release-promotion.mjs', 'release-promotion-source.mjs', 'release-rollup.mjs', 'release-rollup-tree.mjs', 'release-period.mjs', 'release-promotion-github.mjs', 'release-channels.mjs', 'release-history.mjs', 'release-changelog.mjs', 'bump-version.mjs', 'generate-about-info.mjs']) {
    fs.copyFileSync(new URL(name, import.meta.url), path.join(root, 'scripts', name));
  }
  fs.copyFileSync(new URL('../shared/release-channels.json', import.meta.url), path.join(root, 'shared/release-channels.json'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '0.0.1', type: 'module' }));
  fs.writeFileSync(path.join(root, 'backend/Cargo.toml'), '[package]\nversion = "0.0.1"\n');
  fs.writeFileSync(path.join(root, 'backend/Cargo.lock'), '[[package]]\nname = "stage0"\nversion = "0.0.1"\n');
  fs.writeFileSync(path.join(root, 'backend/tauri.conf.json'), JSON.stringify({ version: '0.0.1' }));
  fs.writeFileSync(path.join(root, 'RELEASE_NOTES.md'), '# Stage0 v0.0.1 Release Notes\nThis document describes the current release (v0.0.1).\nCode: `x` ${literal}\n');
  fs.writeFileSync(path.join(root, 'website/index.html'), 'v0.0.1');
  git('add', '.');
  git('commit', '-m', 'main base');
  git('push', '-u', 'origin', 'main');
  const mainSha = git('rev-parse', 'HEAD');

  git('checkout', '-b', 'develop');
  fs.writeFileSync(path.join(root, 'RELEASE_NOTES.md'), '# Stage0 v0.0.1 Release Notes\nThis document describes the current release (v0.0.1).\nDevelop change.\n');
  git('commit', '-am', 'develop work');
  git('push', '-u', 'origin', 'develop');

  git('checkout', '-b', 'beta', 'develop');
  git('push', '-u', 'origin', 'beta');
  let betaSha = git('rev-parse', 'HEAD');

  git('checkout', '-b', 'nightly', 'develop');
  fs.writeFileSync(path.join(root, 'scripts/prepare-release.mjs'), 'throw new Error("channel tooling must not execute in the main controller");');
  git('commit', '-am', 'Untrusted channel tooling fixture');
  git('push', '-u', 'origin', 'nightly');
  let nightlySha = git('rev-parse', 'HEAD');
  git('checkout', 'main');

  // 1. Regular day (Nov 2, 00:00 UTC): Nightly gets v0.0.2-nightly from origin/nightly
  const nightlyDay1 = prepareScheduledBranch({ promotionGuard: () => null, schedule: '0 23 * * *', now: new Date('2026-11-01T23:00:00Z'), root, releases: [] });
  assert.equal(nightlyDay1.tag, 'v0.0.2-nightly');
  assert.equal(nightlyDay1.branch, 'origin/nightly');
  assert.equal(git('rev-parse', `${nightlyDay1.tag}^`), nightlySha);
  assert.equal(JSON.parse(git('show', `${nightlyDay1.tag}:backend/about.json`)).releaseDate, '2026-11-02');

  const updateBranch = (branch, date) => {
    git('checkout', branch);
    fs.writeFileSync(path.join(root, 'change.txt'), date);
    git('add', 'change.txt');
    execFileSync('git', ['commit', '-m', `Source change on ${date}`], { cwd: root,
      env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } });
    git('push', 'origin', branch);
    return git('rev-parse', 'HEAD');
  };
  nightlySha = updateBranch('nightly', '2026-11-26T22:00:00Z');
  betaSha = updateBranch('beta', '2026-11-26T22:00:00Z');

  // 2. 27th of month (Nov 27, 00:00 UTC): even if Beta's cron runs first, Nightly gets v0.0.3-nightly and Beta gets v0.0.4-beta
  const betaOn27 = prepareScheduledBranch({ promotionGuard: () => null, schedule: '0 0 27 * *', now: new Date('2026-11-26T23:00:00Z'), root, releases: [] });
  const nightlyOn27 = prepareScheduledBranch({ promotionGuard: () => null, schedule: '0 23 * * *', now: new Date('2026-11-26T23:02:00Z'), root, releases: [] });
  assert.equal(nightlyOn27.tag, 'v0.0.3-nightly');
  assert.equal(nightlyOn27.reused, true);
  assert.equal(betaOn27.tag, 'v0.0.4-beta');
  assert.equal(compareSemver(nightlyOn27.version, betaOn27.version), -1);
  assert.equal(git('rev-parse', `${nightlyOn27.tag}^`), nightlySha);
  assert.equal(git('rev-parse', `${betaOn27.tag}^`), betaSha);
  assert.equal(JSON.parse(git('show', `${betaOn27.tag}:backend/about.json`)).releaseDate, '2026-11-27');

  nightlySha = updateBranch('nightly', '2026-12-31T22:00:00Z');

  // 3. 1st of quarter (Jan 1, 2027, 00:00 UTC): even if Stable's cron runs first, Nightly gets v0.0.5-nightly and Stable gets v0.0.6
  const stableOnQ1 = prepareScheduledBranch({ promotionGuard: () => null, schedule: '0 0 1 1,4,7,10 *', now: new Date('2026-12-31T23:00:00Z'), root, releases: [] });
  const nightlyOnQ1 = prepareScheduledBranch({ promotionGuard: () => null, schedule: '0 23 * * *', now: new Date('2026-12-31T23:01:00Z'), root, releases: [] });
  assert.equal(nightlyOnQ1.tag, 'v0.0.5-nightly');
  assert.equal(nightlyOnQ1.reused, true);
  assert.equal(stableOnQ1.tag, 'v0.0.6');
  assert.equal(compareSemver(nightlyOnQ1.version, stableOnQ1.version), -1);
  assert.equal(git('rev-parse', `${stableOnQ1.tag}^`), mainSha);
  assert.equal(JSON.parse(git('show', `${stableOnQ1.tag}:backend/about.json`)).releaseDate, '2027-01-01');

  assert.equal(execFileSync('git', ['--git-dir', origin, 'rev-parse', 'refs/heads/main'], { encoding: 'utf8' }).trim(), mainSha);
  assert.equal(execFileSync('git', ['--git-dir', origin, 'rev-parse', 'refs/heads/beta'], { encoding: 'utf8' }).trim(), betaSha);
  assert.equal(execFileSync('git', ['--git-dir', origin, 'rev-parse', 'refs/heads/nightly'], { encoding: 'utf8' }).trim(), nightlySha);
});

test('the actual CI gate allows Stable for scheduled, reusable and manual workflows while blocking raw stable tag pushes', () => {
  const workflow = fs.readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');
  const expression = workflow.match(/    if: >-\n([\s\S]*?)\n    runs-on:/)?.[1];
  assert.ok(expression);
  const gate = new Function('github', 'inputs', 'contains', `return (${expression.trim()});`);
  const allowed = (event, tag, repository = 'anhquoctran/stage0', ref = event === 'push' ? `refs/tags/${tag}` : 'refs/heads/main') => gate(
    { event_name: event, ref_name: tag, repository, ref, ref_type: ref.startsWith('refs/tags/') ? 'tag' : 'branch' },
    event === 'push' ? {} : { tag },
    (value, part) => value.includes(part),
  );
  for (const event of ['workflow_dispatch', 'schedule', 'workflow_call']) {
    assert.equal(allowed(event, 'v0.0.1'), true);
  }
  assert.equal(allowed('push', 'v0.0.1'), false);
  assert.equal(allowed('push', 'v0.0.2-nightly'), true);
  assert.equal(allowed('schedule', 'v0.0.3-beta'), true);
  assert.equal(allowed('workflow_dispatch', 'v0.0.1', 'another/repo'), false);
  assert.equal(allowed('workflow_dispatch', 'v0.0.1', 'anhquoctran/stage0', 'refs/heads/feat/untrusted'), false);
  assert.equal(allowed('workflow_dispatch', 'v0.0.1', 'anhquoctran/stage0', 'refs/tags/v0.0.1'), true);
});

test('git flow policy forbids direct work on protected branches, enforces develop PRs and requires hotfix back-sync', () => {
  assert.deepEqual(branchRiskProfile('develop'), { risk: 'highest', stability: 'unstable' });
  assert.deepEqual(branchRiskProfile('feat/new-ui'), { risk: 'highest', stability: 'unstable' });
  assert.deepEqual(branchRiskProfile('fix/race'), { risk: 'highest', stability: 'unstable' });
  assert.deepEqual(branchRiskProfile('origin/nightly'), { risk: 'high', stability: 'preview' });
  assert.deepEqual(branchRiskProfile('origin/beta'), { risk: 'medium', stability: 'stabilizing' });
  assert.deepEqual(branchRiskProfile('origin/main'), { risk: 'low', stability: 'stable' });

  for (const protectedBranch of ['main', 'beta', 'nightly', 'develop', 'origin/main', 'refs/heads/develop']) {
    assert.throws(
      () => validateGitFlowBranch({ headBranch: protectedBranch, baseBranch: 'develop' }),
      /Direct commits or pushes to protected branch/,
    );
  }

  for (const branch of ['feat/ci-schedule', 'fix/updater-lock', 'refactor/git-ops', 'perf/diff', 'docs/git-flow', 'test/channels', 'chore/deps']) {
    assert.deepEqual(validateGitFlowBranch({ headBranch: branch, baseBranch: 'origin/develop' }), {
      kind: 'standard',
      headBranch: branch,
      baseBranch: 'develop',
      prTarget: 'develop',
      riskProfile: { risk: 'highest', stability: 'unstable' },
      syncBranches: [],
    });
    assert.throws(
      () => validateGitFlowBranch({ headBranch: branch, baseBranch: 'main' }),
      /Standard work branches must branch off and target develop/,
    );
  }

  assert.deepEqual(validateGitFlowBranch({ headBranch: 'hotfix/main/signing-key', baseBranch: 'origin/main' }), {
    kind: 'hotfix',
    headBranch: 'hotfix/main/signing-key',
    baseBranch: 'main',
    prTarget: 'main',
    riskProfile: { risk: 'low', stability: 'stable' },
    syncBranches: ['beta', 'nightly', 'develop'],
  });
  assert.deepEqual(validateGitFlowBranch({ headBranch: 'hotfix/beta/crash-on-open', baseBranch: 'beta' }), {
    kind: 'hotfix',
    headBranch: 'hotfix/beta/crash-on-open',
    baseBranch: 'beta',
    prTarget: 'beta',
    riskProfile: { risk: 'medium', stability: 'stabilizing' },
    syncBranches: ['nightly', 'develop'],
  });
  assert.deepEqual(validateGitFlowBranch({ headBranch: 'hotfix/nightly/parser', baseBranch: 'nightly' }), {
    kind: 'hotfix',
    headBranch: 'hotfix/nightly/parser',
    baseBranch: 'nightly',
    prTarget: 'nightly',
    riskProfile: { risk: 'high', stability: 'preview' },
    syncBranches: ['develop'],
  });

  assert.throws(
    () => validateGitFlowBranch({ headBranch: 'hotfix/dev-only', baseBranch: 'develop' }),
    /Hotfix branches must branch off and target main, beta or nightly/,
  );
  assert.throws(
    () => validateGitFlowBranch({ headBranch: 'random-branch', baseBranch: 'develop' }),
    /Branch name must use/,
  );
});

test('automation promotion branches identify the calendar batch, never a single tag or wrong target', () => {
  assert.equal(validateGitFlowBranch({ headBranch: 'promotion/beta/2026-11-27', baseBranch: 'beta' }).kind, 'promotion');
  assert.equal(validateGitFlowBranch({ headBranch: 'promotion/stable/2027-01-01', baseBranch: 'main' }).prTarget, 'main');
  assert.throws(() => validateGitFlowBranch({ headBranch: 'promotion/beta/v0.0.8-nightly', baseBranch: 'beta' }), /calendar period/);
  assert.throws(() => validateGitFlowBranch({ headBranch: 'promotion/beta/2026-11-26', baseBranch: 'beta' }), /day 27/);
  assert.throws(() => validateGitFlowBranch({ headBranch: 'promotion/stable/2027-01-01', baseBranch: 'beta' }), /configured branch/);
});
