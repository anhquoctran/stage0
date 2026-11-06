import { releaseGit } from './release-history.mjs';
import { policy } from './release-channels.mjs';
import { promotionApi } from './release-promotion-github.mjs';
import { planRollup, rollupBranch } from './release-rollup.mjs';
import { composeRollup } from './release-rollup-tree.mjs';

export function createRollupPullRequest({ root, channel, releaseDate, now = new Date(), api = promotionApi }) {
  const route = policy.promotion.routes[channel];
  if (!route) throw new Error('Only beta/stable period rollups are supported');
  const branch = rollupBranch(channel, releaseDate);
  releaseGit(root, 'fetch', 'origin', `refs/heads/${route.branch}`);
  const baseSha = releaseGit(root, 'rev-parse', 'FETCH_HEAD^{commit}');
  const manifest = planRollup({ root, channel, releaseDate, baseSha, now, api });
  if (!manifest) return { skipped: true, reason: 'No eligible published source builds in this period' };
  const composed = composeRollup(root, manifest);
  if (!composed.changed) return { skipped: true, reason: 'All eligible changes are already in the target; no new source changes' };
  const existing = api(`pulls?state=open&base=${route.branch}&head=anhquoctran:${encodeURIComponent(branch)}`);
  let pr = existing[0];
  if (pr && pr.head.sha !== composed.sha) throw new Error('Existing rollup differs; close it and delete its frozen head before regenerating; never force-push a reviewed batch');
  if (!pr) {
    // All objects were built with Git plumbing; no candidate checkout or execution.
    releaseGit(root, 'push', 'origin', `${composed.sha}:refs/heads/${branch}`);
    pr = api('pulls', { method: 'POST', body: { base: route.branch, head: branch,
      title: `release: ${channel} rollup ${releaseDate}`,
      body: `Accumulate **all ${manifest.sources.length} eligible ${route.from} releases** published in `
        + `[${manifest.window.start}, ${manifest.window.end}) UTC.\n\n`
        + `Unique new commits: **${manifest.commits.length}**. The frozen ledger in \`.github/release-rollup.json\` records every tag, source SHA, build run, commit and rejected build.\n\n`
        + `Source releases: ${manifest.sources.map(source => source.tag).join(', ')}.\n\n`
        + (manifest.skipped.length ? `Rejected builds: ${manifest.skipped.map(source => `${source.tag}: ${source.reason}`).join('; ')}.\n\n` : '')
        + '**Maintainer activation:** Close and reopen this bot-authored PR once to trigger CodeQL. '
        + 'Review all changes/known regressions; green CI alone is not a stability verdict. '
        + 'Do not remove individual commits from this frozen head: fix/revert in the source channel and regenerate a tested batch.\n\n'
        + '- [ ] Smoke-tested install/update, launch, diff and reviewer on supported platforms.\n'
        + '- [ ] Reviewed changes and known issues; ready for this channel.\n\n'
        + (composed.regressionPolicyChanges.length ? '- [ ] Regression control-plane changes reviewed.\n\n' : '')
        + 'Approve this exact head and create a merge commit on the scheduled UTC release date. The complete assembled batch is rebuilt and signed before publication.',
    } });
  }
  api('actions/workflows/promotion-policy.yml/dispatches', { method: 'POST', body: { ref: 'main', inputs: { pr: String(pr.number) } } });
  return { pr, manifest, sha: composed.sha, skipped: false };
}
