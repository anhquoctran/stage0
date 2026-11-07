import fs from 'node:fs';
import { createRollupPullRequest } from './release-rollup-controller.mjs';
import { policy } from './release-channels.mjs';
import { RELEASE_REPOSITORY } from './release-history.mjs';
import { promotionApi } from './release-promotion-github.mjs';
import {
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
  status('pending', 'Verifying full release period, eligible builds and frozen merge tree');
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
  const result = createRollupPullRequest({ root, channel: process.env.PROMOTION_CHANNEL,
    releaseDate: process.env.PROMOTION_DATE || new Date().toISOString().slice(0, 10) });
  summary(result.skipped ? `Rollup skipped: ${result.reason}` : `Period rollup PR: ${result.pr.html_url}`);
} else if (mode === 'verify-release') {
  const result = assertPublishedPromotion({ root, channel: process.env.RELEASE_CHANNEL, sourceSha: process.env.RELEASE_SOURCE_SHA });
  if (result) summary(`Release authorized by promotion PR #${result.pr}: ${result.candidate.tag} → ${result.channel}.`);
} else throw new Error('Usage: release-promotion-cli.mjs check-pr | create | verify-release');
