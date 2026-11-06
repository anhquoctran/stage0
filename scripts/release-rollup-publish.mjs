import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { releaseGit, releaseSource, publishedReleases } from './release-history.mjs';
import { readRollup } from './release-rollup-tree.mjs';
import { releasePeriod, assertReleaseDay } from './release-period.mjs';
import { assertPublishedPromotion } from './release-promotion.mjs';
import { prepareScheduledBranch } from './prepare-release.mjs';
import { assertPromotionSecurity } from './release-promotion-github.mjs';
import { dispatchTagRelease } from './dispatch-tag-release.mjs';

export async function publishRollup({ root = process.cwd(), env = process.env, now = () => new Date(),
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), authorize = assertPublishedPromotion,
  security = (branch, sha) => assertPromotionSecurity({ base: { ref: branch }, merge_commit_sha: sha }, undefined, { merged: true }),
  releasesFor = publishedReleases, prepare = prepareScheduledBranch, dispatch = dispatchTagRelease } = {}) {
  const channel = { 'refs/heads/beta': 'beta', 'refs/heads/main': 'stable' }[env.GITHUB_REF];
  if (env.GITHUB_REPOSITORY !== 'anhquoctran/stage0' || !channel) throw new Error('Only canonical beta/main controllers may publish a rollup');
  const branch = channel === 'beta' ? 'beta' : 'main';
  releaseGit(root, 'fetch', 'origin', `refs/heads/${branch}`);
  const sourceSha = releaseGit(root, 'rev-parse', 'FETCH_HEAD^{commit}');
  const ledger = readRollup(root, sourceSha);
  if (!ledger || ledger.channel !== channel || ledger.releaseDate !== now().toISOString().slice(0, 10)) {
    return { skipped: true, reason: 'No approved rollup for this channel and UTC release date' };
  }
  const period = releasePeriod(channel, ledger.releaseDate);
  assertReleaseDay(period, now());
  // Default CodeQL scans run after the human merge. Wait for that exact commit,
  // never for an unrelated green scan. Other policy/security failures are fatal.
  for (let attempt = 0; ; attempt++) {
    const current = releaseGit(root, 'ls-remote', 'origin', `refs/heads/${branch}`).split('\t')[0];
    if (current !== sourceSha) throw new Error('Release source is superseded by a newer channel head');
    try { security(branch, sourceSha); break; }
    catch (error) {
      if (attempt >= 40 || !error.message.startsWith('Successful current CodeQL ')) throw error;
      console.log('Waiting for CodeQL on the approved merge commit');
      await sleep(30000);
    }
    assertReleaseDay(period, now());
  }
  // Expensive per-build inventory/provenance validation runs once after CodeQL,
  // rather than consuming the Actions API rate limit on every poll.
  authorize({ root, channel, sourceSha, now: now() });
  const releases = releasesFor(root);
  const tagPattern = channel === 'beta' ? /^v\d+\.\d+\.\d+-beta$/ : /^v\d+\.\d+\.\d+$/;
  if (releases.some(release => !release.draft && release.published_at && tagPattern.test(release.tag_name || '')
    && releaseSource(root, release.tag_name) === sourceSha)) {
    return { skipped: true, reason: 'This rollup source has already been published' };
  }
  const plan = prepare({ root, schedule: channel, onlyChannel: true, releaseDateOverride: ledger.releaseDate, now: now(), releases });
  if (!plan.shouldBuild) return { skipped: true, reason: plan.reason };
  await dispatch({ ...env, RELEASE_TAG: plan.tag, RELEASE_SNAPSHOT_SHA: plan.sha, RELEASE_PUBLISH_AT: plan.publishAt });
  return { skipped: false, tag: plan.tag };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await publishRollup();
  const message = result.skipped ? `Rollup not published: ${result.reason}` : `Requested signed rollup build: ${result.tag}`;
  console.log(message);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${message}\n`);
}
