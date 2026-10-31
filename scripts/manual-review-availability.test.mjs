import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';

const root = '../frontend/features/virtual-mr/';
const { getManualReviewBlockReason } = loadWithMocks(new URL(`${root}utils/manualReviewAvailability.ts`, import.meta.url), {});
const openThread = () => ({ id: 'finding', filePath: 'src/service.ts', isResolved: false });
const sessionFixture = () => ({ id: 'mr', title: 'Fixture MR', status: 'open', reviewers: [{ agentId: 'bot', agentName: 'Bot' }], discussions: [openThread()] });
const noop = () => {};

test('only unresolved code threads block manual reviews, including outdated findings', () => {
  assert.equal(getManualReviewBlockReason(null), null);
  assert.equal(getManualReviewBlockReason({ discussions: [{ isResolved: false, filePath: null }] }), null);
  assert.equal(getManualReviewBlockReason({ discussions: [{ ...openThread(), isResolved: true }] }), null);
  assert.match(getManualReviewBlockReason({ discussions: [openThread(), { ...openThread(), verificationStatus: 'outdated' }] }), /Resolve open code discussions.*Open: 2\./);
});

test('the MR review action checks live discussions even if its captured session was stale', async () => {
  const session = sessionFixture();
  const stale = { ...session, discussions: [] };
  const toasts = [];
  let starts = 0;
  const { createStartMrReviewAction } = loadWithMocks(new URL(`${root}services/createStartMrReviewAction.ts`, import.meta.url), {
    '../store/useVirtualMrStore': { useVirtualMrStore: { getState: () => ({ sessions: [session] }) } },
    '../../review/services/assignedReviewService': { startAssignedReviewBatchForSession: async () => {
      starts++;
      return { runs: [{ status: 'completed' }], failures: [], descriptionGenerated: true, hasChanges: true };
    } },
  });
  const start = createStartMrReviewAction(stale, (...args) => toasts.push(args));
  await start();
  assert.equal(starts, 0);
  assert.match(toasts[0][0], /Resolve open code discussions.*Open: 1\./);
  session.discussions[0].isResolved = true;
  await start();
  assert.equal(starts, 1);
  session.discussions[0].isResolved = false;
  await start();
  assert.equal(starts, 1);
});

test('the review panel routes manual requests through a new discussion and has no review-start button', async () => {
  const harness = componentHarness();
  const session = sessionFixture();
  let starts = 0;
  const { ReviewConfigurationSection } = loadWithMocks(new URL('../frontend/features/review/components/ReviewConfigurationSection.tsx', import.meta.url), {
    react: harness.react,
    '../../../common/components/CustomSelect': { CustomSelect: () => null },
    '../../ai/constants/aiPresets': { AI_PROVIDERS: [] },
    '../../preferences/store/usePreferencesStore': {},
  });
  const props = {
    session, effectiveReviewerId: 'global', setSelectedReviewerId: noop, GLOBAL_REVIEWER_ID: 'global',
    config: { model: 'fixture' }, reviewerProfiles: [], externalAgents: [], selectedReviewer: undefined,
    reviewConfig: { provider: 'ollama' }, compatible: true, close: noop, allowRemote: false,
    setAllowRemote: noop, isStarting: false, hasRunning: false, start: async () => { starts++; }, running: false, cancel: noop,
  };
  const render = async () => componentNodes(await harness.render(ReviewConfigurationSection, props));
  const nodes = await render();
  const text = nodes.map((node) => JSON.stringify(node.children || node.props?.children || '')).join(' ');
  assert.match(text, /new discussion/);
  assert.match(text, /review/);
  assert.equal(nodes.some((node) => node.type === 'button' && /Start new review|Review as/.test(JSON.stringify(node.props.children))), false);
  assert.equal(starts, 0);
  harness.cleanup();
});

test('review history exposes no direct review-start button', async () => {
  const harness = componentHarness();
  const session = sessionFixture();
  const state = { runs: [], detail: null, load: noop, syncActive: noop, publish: noop, isPublishing: false, activeRuns: {}, reviewBatches: {}, isStarting: false };
  const dependencies = {
    react: harness.react,
    '../../../../common/components/CustomSelect': { CustomSelect: () => null },
    '../../../git/store/useGitStore': { useGitStore: () => ({ showToast: noop }) },
    '../../../review/store/useReviewStore': { useReviewStore: () => state },
    '../../services/createStartMrReviewAction': { createStartMrReviewAction: () => noop },
    '../../../review/components/ReviewFindingCard': { ReviewFindingCard: () => null },
    '../../../review/components/ReviewRunSummary': { ReviewRunSummary: () => null },
  };
  for (const name of ['Bot', 'CheckCircle2', 'RefreshCw', 'ShieldCheck', 'Terminal']) {
    dependencies[`../../../../common/components/icons/${name}`] = { [name]: () => null };
  }
  const { VirtualMrReviewsTab } = loadWithMocks(new URL(`${root}components/hub/VirtualMrReviewsTab.tsx`, import.meta.url), dependencies);
  const render = async () => componentNodes(await harness.render(VirtualMrReviewsTab, { session }));
  const nodes = componentNodes(await harness.render(VirtualMrReviewsTab, { session }));
  assert.equal(nodes.some((node) => node.type === 'button' && /Run AI Code Review|Start AI Code Review/.test(JSON.stringify(node.props.children))), false);
  assert.equal((await render()).some((node) => node.type === 'button' && /Run AI Code Review/.test(JSON.stringify(node.props.children))), false);
  harness.cleanup();
});

test('the MR header has no AI review button', async () => {
  const harness = componentHarness();
  const session = sessionFixture();
  const dependencies = {
    react: harness.react,
    '@/common/components/icons': { XCircle: () => null },
    '../../../git/components/TabBranchSelector': { TabBranchSelector: () => null },
  };
  for (const name of ['ArrowRight', 'Check', 'CheckCircle2', 'Edit2', 'Lock', 'X']) {
    dependencies[`../../../../common/components/icons/${name}`] = { [name]: () => null };
  }
  const { VirtualMrHeader } = loadWithMocks(new URL(`${root}components/hub/VirtualMrHeader.tsx`, import.meta.url), dependencies);
  const props = { session, sequenceNumber: 1 };
  const nodes = componentNodes(await harness.render(VirtualMrHeader, props));
  assert.equal(nodes.some((node) => node.type === 'button' && /AI code review|Start a review/.test(JSON.stringify(node.props.title || node.props.children))), false);
  harness.cleanup();
});
