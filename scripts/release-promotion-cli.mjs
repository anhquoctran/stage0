import fs from 'node:fs';
import { policy } from './release-channels.mjs';
import { RELEASE_REPOSITORY, releaseGit } from './release-history.mjs';
import { promotionApi } from './release-promotion-github.mjs';
import {
  promotionRoute, parsePromotionBranch, fetchPromotionSource, assertCandidateAge, assertPromotionTree,
  assertPromotionPullRequest, assertPublishedPromotion,
} from './release-promotion.mjs';

const root = process.cwd();
const mode = process.argv[2];
if (process.env.GITHUB_REPOSITORY !== RELEASE_REPOSITORY) throw new Error('Canonical repository only');
const summary = text => {
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
};

if (mode === 'check-pr') {
  // pull_request_target uses trusted base code. Publish the status on PR HEAD
  // explicitly, since its own GITHUB_SHA belongs to the base branch.
  const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  if (process.env.GITHUB_EVENT_NAME === 'workflow_dispatch' && process.env.GITHUB_REF !== 'refs/heads/main') throw new Error('Manual policy checks must run on main');
  const number = String(event.number || process.env.PROMOTION_PR || '');
  if (!/^\d+$/.test(number)) throw new Error('Invalid promotion PR number');
  const pr = promotionApi(`pulls/${number}`);
  const status = (state, description) => promotionApi(`statuses/${pr.head.sha}`, { method: 'POST', body: {
    state, context: policy.promotion.requiredCheck, description,
    target_url: `https://github.com/${RELEASE_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
  } });
  status('pending', 'Verifying frozen release candidate, soak time and merge tree');
  try {
    const result = assertPromotionPullRequest(root, pr);
    status('success', `Verified ${result.candidate.tag} → ${result.channel}`);
    summary(`Verified ${result.candidate.tag} (${result.candidate.sourceSha}) → ${result.channel}, PR #${pr.number}. Human approval is required before merge.`);
  } catch (error) {
    status('failure', 'Promotion blocked; see workflow summary');
    summary(`Promotion blocked: ${error.message}`);
    throw error;
  }
} else if (mode === 'create') {
  if (process.env.GITHUB_REF !== 'refs/heads/main') throw new Error('Run the trusted promotion controller on main');
  const channel = process.env.PROMOTION_CHANNEL;
  const route = promotionRoute(channel);
  const tag = process.env.PROMOTION_TAG;
  const candidate = fetchPromotionSource(root, tag);
  const branch = `promotion/${channel}/${tag}`;
  // Shared parser also rejects skipped channels and malformed tag names.
  parsePromotionBranch(branch, channel);
  assertCandidateAge(candidate, channel);
  releaseGit(root, 'fetch', 'origin', `refs/heads/${route.branch}`);
  const baseSha = releaseGit(root, 'rev-parse', 'FETCH_HEAD^{commit}');
  assertPromotionTree(root, baseSha, candidate.sourceSha, candidate.sourceSha);
  if (releaseGit(root, 'rev-parse', `${baseSha}^{tree}`) === releaseGit(root, 'rev-parse', `${candidate.sourceSha}^{tree}`)) {
    throw new Error('Target already has this candidate content; no promotion needed');
  }
  const existing = promotionApi(`pulls?state=open&base=${route.branch}&head=anhquoctran:${encodeURIComponent(branch)}`);
  let prNumber = existing[0]?.number;
  if (existing.length) { summary(`Existing promotion PR: ${existing[0].html_url}`); }
  else {
    // Never update/force an existing candidate ref; API returns 422 on collision.
    let ref;
    try { ref = promotionApi(`git/ref/heads/${branch}`); } catch { /* Creation below fails closed if API is unavailable. */ }
    if (ref && ref.object.sha !== candidate.sourceSha) throw new Error('Existing frozen candidate branch has moved');
    if (!ref) promotionApi('git/refs', { method: 'POST', body: { ref: `refs/heads/${branch}`, sha: candidate.sourceSha } });
    const pr = promotionApi('pulls', { method: 'POST', body: {
      base: route.branch, head: branch, title: `release: promote ${tag} to ${channel}`,
      body: `Promote the published ${route.from} candidate [${tag}](${candidate.release.html_url}) to ${channel}.\n\n`
        + `Source: ${candidate.sourceSha}\nBuild: ${candidate.run.html_url}\n`
        + `Minimum observation: ${route.minimumAgeHours} hours.\n\n`
        + '**Maintainer activation:** Close and reopen this bot-authored PR once to trigger CodeQL. '
        + 'GitHub suppresses PR events created by GITHUB_TOKEN. Wait for all CodeQL analyses, then complete the checklist.\n\n'
        + '- [ ] Smoke-tested install/update, launch, diff and reviewer on supported platforms.\n'
        + '- [ ] Reviewed changes and known issues; ready for this channel.\n\n'
        + 'Approve this exact commit and use **Create a merge commit**. Conflicts or content changes require a new lower-channel build.',
    } });
    prNumber = pr.number;
    summary(`Promotion PR: ${pr.html_url}`);
  }
  // GITHUB_TOKEN-created PRs do not trigger pull_request_target. Explicitly
  // dispatch its trusted workflow; never grant a candidate write credentials.
  promotionApi('actions/workflows/promotion-policy.yml/dispatches', { method: 'POST', body: {
    ref: 'main', inputs: { pr: String(prNumber) },
  } });
} else if (mode === 'verify-release') {
  const result = assertPublishedPromotion({ root, channel: process.env.RELEASE_CHANNEL, sourceSha: process.env.RELEASE_SOURCE_SHA });
  if (result) summary(`Release authorized by promotion PR #${result.pr}: ${result.candidate.tag} → ${result.channel}.`);
} else throw new Error('Usage: release-promotion-cli.mjs check-pr | create | verify-release');
