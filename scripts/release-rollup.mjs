import { policy, releaseChannel } from './release-channels.mjs';
import { releaseGit } from './release-history.mjs';
import { promotionApi, InvalidReleaseCandidate } from './release-promotion-github.mjs';
import { fetchPromotionSource } from './release-promotion-source.mjs';
import { releasePeriod, inReleasePeriod, assertPeriodClosed, assertReleaseDay } from './release-period.mjs';
import { readRollup, rollupCommits, composeRollup } from './release-rollup-tree.mjs';

export function rollupBranch(channel, date) {
  releasePeriod(channel, date);
  return `promotion/${channel}/${date}`;
}

export function rollupBranchDate(branch, channel) {
  const prefix = `promotion/${channel}/`;
  if (!branch?.startsWith(prefix)) return null;
  const date = branch.slice(prefix.length);
  if (!/^\d{4}-\d\d-\d\d$/.test(date)) return null;
  releasePeriod(channel, date);
  return date;
}

export function planRollup({ root, channel, releaseDate, baseSha, now = new Date(),
  api = promotionApi, releases = api('releases?per_page=100', { paginated: true }), candidateFor = fetchPromotionSource }) {
  const window = releasePeriod(channel, releaseDate);
  assertPeriodClosed(window, now);
  if (!/^[a-f0-9]{40}$/.test(baseSha || '')) throw new Error('Invalid rollup base SHA');
  const from = policy.promotion.routes[channel].from;
  const releasesInPeriod = releases.filter(release => {
    if (!inReleasePeriod(release, window)) return false;
    try { return release.tag_name.startsWith('v') && releaseChannel(release.tag_name.slice(1)) === from; }
    catch { return false; }
  }).sort((a, b) => Date.parse(a.published_at) - Date.parse(b.published_at) || a.tag_name.localeCompare(b.tag_name));
  const sources = [], skipped = [];
  for (const release of releasesInPeriod) {
    let candidate;
    try { candidate = candidateFor(root, release.tag_name, api, { release }); }
    catch (error) {
      if (!(error instanceof InvalidReleaseCandidate)) throw error; // Network/auth/history errors never become an empty period.
      skipped.push({ tag: release.tag_name, reason: error.message });
      continue;
    }
    sources.push({ tag: candidate.tag, tagSha: candidate.sha, sourceSha: candidate.sourceSha,
      publishedAt: candidate.release.published_at, runId: candidate.run.id,
      runAttempt: candidate.run.run_attempt, completedAt: candidate.run.updated_at });
  }
  if (!sources.length) return null;
  return { schemaVersion: 1, channel, releaseDate, window, baseSha, sources, skipped,
    commits: rollupCommits(root, baseSha, sources) };
}

export function assertRollupPullRequest(root, pr, channel, { api = promotionApi, now = new Date(), merged = false } = {}) {
  const releaseDate = rollupBranchDate(pr.head.ref, channel);
  if (!releaseDate) throw new Error('Use a periodic promotion/<channel>/YYYY-MM-DD rollup branch');
  releaseGit(root, 'fetch', 'origin', pr.head.sha);
  const manifest = readRollup(root, pr.head.sha);
  if (!manifest || manifest.channel !== channel || manifest.releaseDate !== releaseDate) throw new Error('Missing/mismatched rollup ledger');
  assertReleaseDay(releasePeriod(channel, releaseDate), now);
  const baseSha = merged ? releaseGit(root, 'show', '-s', '--format=%P', pr.merge_commit_sha).split(' ')[0] : pr.base.sha;
  if (baseSha !== manifest.baseSha) throw new Error('Target changed since rollup planning; regenerate and review a new batch');
  const expected = planRollup({ root, channel, releaseDate, baseSha, now, api });
  if (!expected || JSON.stringify(expected) !== JSON.stringify(manifest)) throw new Error('Period inventory, build evidence or commit selection changed; regenerate rollup');
  const composed = composeRollup(root, expected);
  if (composed.sha !== pr.head.sha || !composed.changed) throw new Error('Rollup head differs from the complete validated period or contains no new source changes');
  return { tag: `${channel}-${releaseDate}`, sourceSha: pr.head.sha, manifest };
}
