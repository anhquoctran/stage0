import { policy, releaseChannel } from './release-channels.mjs';
import { RELEASE_REPOSITORY, releaseGit, releaseSource } from './release-history.mjs';
import { assertRegressionRefs } from './release-regression-preservation.mjs';
import { assertRollupPullRequest, rollupBranchDate } from './release-rollup.mjs';
import { fetchPromotionSource } from './release-promotion-source.mjs';
export { fetchPromotionSource } from './release-promotion-source.mjs';
import { promotionApi, assertPromotionSecurity } from './release-promotion-github.mjs';
import { fetchDevelopmentCandidate } from './release-development-source.mjs';

export function promotionRoute(channel) {
  const route = Object.hasOwn(policy.promotion.routes, channel) ? policy.promotion.routes[channel] : null;
  if (!route) throw new Error('Only develop → beta and beta → stable promotions are supported');
  return route;
}

export function parsePromotionBranch(branch, channel) {
  const prefix = `promotion/${channel}/`;
  if (!branch?.startsWith(prefix)) throw new Error(`Use a frozen ${prefix}TAG branch`);
  const tag = branch.slice(prefix.length);
  if (promotionRoute(channel).from === 'develop') {
    if (!/^develop\/pr-[1-9]\d*\/[a-f0-9]{40}$/.test(tag)) throw new Error('Candidate must identify an immutable develop PR merge');
    return tag;
  }
  if (!tag.startsWith('v') || releaseChannel(tag.slice(1)) !== promotionRoute(channel).from) {
    throw new Error('Candidate tag must belong to the immediately preceding channel');
  }
  return tag;
}

export function assertCandidateAge(candidate, channel, now = new Date()) {
  const hours = promotionRoute(channel).hotfixMinimumAgeHours;
  if (!Number.isFinite(now.getTime()) || !Number.isFinite(candidate.readySince)
    || now.getTime() - candidate.readySince < hours * 3600000) {
    throw new Error(`${candidate.tag} requires ${hours} hours of observation after successful publication/build`);
  }
}

export function assertPromotionTree(root, baseSha, headSha, sourceSha) {
  if (headSha !== sourceSha) throw new Error('Promotion branch moved away from the tested candidate source SHA');
  try { releaseGit(root, 'merge-base', '--is-ancestor', baseSha, sourceSha); }
  catch { throw new Error('Target is ahead/divergent; back-sync it into the source channel and publish a new candidate'); }
  // A clean textual merge can still introduce untested target-branch changes.
  const tree = releaseGit(root, 'merge-tree', '--write-tree', baseSha, headSha).split('\n')[0];
  if (tree !== releaseGit(root, 'rev-parse', `${sourceSha}^{tree}`)) {
    throw new Error('Merge changes tested candidate content; back-sync target fixes and publish a new candidate');
  }
}

export function assertPromotionPullRequest(root, pr, { api = promotionApi, now = new Date(), merged = false } = {}) {
  const channel = { beta: 'beta', main: 'stable' }[pr.base.ref];
  promotionRoute(channel);
  if (pr.draft || pr.head.repo?.full_name !== RELEASE_REPOSITORY || pr.base.repo?.full_name !== RELEASE_REPOSITORY) {
    throw new Error('Promotion requires a ready PR inside the canonical repository');
  }
  const hotfix = new RegExp(`^hotfix/(?:${pr.base.ref}|sync-${pr.base.ref})/[a-z0-9][a-z0-9._/-]*$`, 'i').test(pr.head.ref);
  let candidate;
  if (rollupBranchDate(pr.head.ref, channel)) {
    if (merged) {
      releaseGit(root, 'fetch', 'origin', pr.merge_commit_sha);
      const parents = releaseGit(root, 'show', '-s', '--format=%P', pr.merge_commit_sha).split(' ');
      if (parents.length !== 2 || parents[1] !== pr.head.sha) throw new Error('Use a merge commit, never squash/rebase a promotion');
    }
    candidate = assertRollupPullRequest(root, pr, channel, { api, now, merged });
    const base = merged ? releaseGit(root, 'show', '-s', '--format=%P', pr.merge_commit_sha).split(' ')[0] : pr.base.sha;
    assertPromotionTree(root, base, pr.head.sha, pr.head.sha);
  } else {
    // Urgent certified hotfixes retain the explicit adjacent-candidate route.
    if (!hotfix) throw new Error('Regular promotions require a complete calendar-period rollup, not one candidate tag');
    const declared = pr.body?.match(/^Stage0-Candidate: ([^\s]+)$/gm) || [];
    if (declared.length !== 1) throw new Error('Declare exactly one Stage0-Candidate for a certified hotfix');
    const tag = parsePromotionBranch(`promotion/${channel}/${declared[0].slice('Stage0-Candidate: '.length)}`, channel);
    candidate = promotionRoute(channel).from === 'develop'
      ? fetchDevelopmentCandidate(root, tag, api, now) : fetchPromotionSource(root, tag, api);
    assertCandidateAge(candidate, channel, now);
    let baseSha = pr.base.sha;
    if (merged) {
      releaseGit(root, 'fetch', 'origin', pr.merge_commit_sha);
      const parents = releaseGit(root, 'show', '-s', '--format=%P', pr.merge_commit_sha).split(' ');
      if (parents.length !== 2 || parents[1] !== pr.head.sha) throw new Error('Use a merge commit, never squash/rebase a promotion');
      baseSha = parents[0];
    }
    releaseGit(root, 'fetch', 'origin', baseSha, pr.head.sha);
    if (releaseGit(root, 'rev-parse', `${pr.head.sha}^{tree}`) !== releaseGit(root, 'rev-parse', `${candidate.sourceSha}^{tree}`)) {
      throw new Error('Hotfix must have the exact content of its certified lower-channel candidate');
    }
    assertPromotionTree(root, baseSha, pr.head.sha, pr.head.sha);
  }
  const regressionBase = merged ? releaseGit(root, 'show', '-s', '--format=%P', pr.merge_commit_sha).split(' ')[0] : pr.base.sha;
  const policyChanges = assertRegressionRefs(root, regressionBase, pr.head.sha);
  if (policyChanges.length && !pr.body?.includes('- [x] Regression control-plane changes reviewed.')) {
    throw new Error('Regression control-plane changes require explicit review acknowledgement');
  }
  assertPromotionSecurity(pr, api, { merged });
  if (!pr.body?.includes('- [x] Smoke-tested install/update, launch, diff and reviewer on supported platforms.')
    || !pr.body?.includes('- [x] Reviewed changes and known issues; ready for this channel.')) {
    throw new Error('Complete both smoke-test and release-readiness checklist items before approval');
  }
  if (merged) {
    if (!pr.merged || !pr.merge_commit_sha || pr.state !== 'closed') throw new Error('An approved merged promotion PR is required');
    const reviews = api(`pulls/${pr.number}/reviews?per_page=100`, { paginated: true });
    const latest = new Map();
    for (const review of reviews) {
      if (['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review.state)
        && review.submitted_at && Date.parse(review.submitted_at) <= Date.parse(pr.merged_at)) latest.set(review.user.login, review);
    }
    if (![...latest.values()].some(review => review.state === 'APPROVED' && review.commit_id === pr.head.sha
      && review.user.login !== pr.user.login && review.user.type === 'User'
      && ['OWNER', 'MEMBER', 'COLLABORATOR'].includes(review.author_association))) {
      throw new Error('A human approval of the exact candidate commit is required');
    }
    const statuses = api(`commits/${pr.head.sha}/statuses?per_page=100`, { paginated: true });
    const status = statuses.find(status => status.context === policy.promotion.requiredCheck
      && Date.parse(status.created_at) <= Date.parse(pr.merged_at));
    if (!status || status.state !== 'success' || status.creator?.login !== 'github-actions[bot]'
      || !status.target_url?.startsWith(`https://github.com/${RELEASE_REPOSITORY}/actions/runs/`)) {
      throw new Error('Promotion policy status must pass on the exact head before merge');
    }
    releaseGit(root, 'fetch', 'origin', pr.merge_commit_sha);
    if (releaseGit(root, 'rev-parse', `${pr.merge_commit_sha}^{tree}`)
      !== releaseGit(root, 'rev-parse', `${candidate.sourceSha}^{tree}`)) throw new Error('Merged promotion tree differs from tested candidate');
  }
  return { channel, candidate, pr: pr.number };
}

/** Shared by scheduled, manual and tag entry points, before allocating a version. */
export function assertPublishedPromotion({ root, channel, sourceSha, api = promotionApi, now = new Date() }) {
  const source = releaseSource(root, sourceSha);
  const branch = promotionRoute(channel).branch;
  const prs = api(`commits/${source}/pulls?per_page=100`, { paginated: true });
  const pr = prs.find(pr => pr.merged_at && pr.merge_commit_sha === source && pr.base.ref === branch);
  if (!pr) throw new Error(`${channel} source must be the merge commit of an approved ${promotionRoute(channel).from} promotion PR`);
  releaseGit(root, 'fetch', 'origin', `refs/heads/${branch}`);
  if (releaseGit(root, 'rev-parse', 'FETCH_HEAD^{commit}') !== source) {
    throw new Error('Release source is superseded by a newer channel head');
  }
  const result = assertPromotionPullRequest(root, api(`pulls/${pr.number}`), { api, now, merged: true });
  if (result.channel !== channel) throw new Error('Promotion channel mismatch');
  return result;
}
