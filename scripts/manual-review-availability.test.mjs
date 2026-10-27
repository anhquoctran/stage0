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
  assert.match(getManualReviewBlockReason({ discussions: [openThread(), { ...openThread(), verificationStatus: 'outdated' }] }), /Resolve 2 open code discussions/);
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
  assert.match(toasts[0][0], /Resolve 1 open code discussion/);
  session.discussions[0].isResolved = true;
  await start();
  assert.equal(starts, 1);
  session.discussions[0].isResolved = false;
  await start();
  assert.equal(starts, 1);
});

test('the review panel disables startup and its handler until the final code thread is resolved', async () => {
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
  const startButton = (nodes) => nodes.find((node) => node.type === 'button' && node.props.children.flat(Infinity).includes('Start new review'));
  let nodes = await render();
  assert.equal(startButton(nodes).props.disabled, true);
  startButton(nodes).props.onClick();
  assert.equal(starts, 0);
  assert.ok(nodes.some((node) => node.props.role === 'status'));
  session.discussions[0].isResolved = true;
  nodes = await render();
  assert.equal(startButton(nodes).props.disabled, false);
  startButton(nodes).props.onClick();
  assert.equal(starts, 1);
  harness.cleanup();
});

test('both review history entry buttons react to unresolved discussions', async () => {
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
  const render = async () => componentNodes(await harness.render(VirtualMrReviewsTab, { session }))
    .filter((node) => node.type === 'button' && node.props.title?.includes('Resolve'));
  assert.equal((await render()).length, 2);
  assert.ok((await render()).every((button) => button.props.disabled));
  session.discussions[0].isResolved = true;
  const nodes = componentNodes(await harness.render(VirtualMrReviewsTab, { session }));
  const buttons = nodes.filter((node) => node.type === 'button' && typeof node.props.disabled === 'boolean');
  assert.equal(buttons.length, 2);
  assert.ok(buttons.every((button) => !button.props.disabled));
  harness.cleanup();
});

test('the MR header blocks its manual action and explains the open-discussion requirement', async () => {
  const harness = componentHarness();
  const session = sessionFixture();
  let starts = 0;
  const dependencies = {
    react: harness.react,
    '@/common/components/icons': { XCircle: () => null },
    '../../../git/components/TabBranchSelector': { TabBranchSelector: () => null },
  };
  for (const name of ['ArrowRight', 'Check', 'CheckCircle2', 'Edit2', 'Lock', 'RefreshCw', 'X']) {
    dependencies[`../../../../common/components/icons/${name}`] = { [name]: () => null };
  }
  const { VirtualMrHeader } = loadWithMocks(new URL(`${root}components/hub/VirtualMrHeader.tsx`, import.meta.url), dependencies);
  const props = { session, sequenceNumber: 1, hasAssignedReviewer: true, reviewBatch: null, reviewIsStarting: false, reviewIsRunning: false, handleStartAiReview: async () => { starts++; } };
  const button = async () => componentNodes(await harness.render(VirtualMrHeader, props))
    .find((node) => node.type === 'button' && node.props.title?.match(/Resolve|Start a review/));
  const blocked = await button();
  assert.equal(blocked.props.disabled, true);
  blocked.props.onClick();
  assert.equal(starts, 0);
  session.discussions[0].isResolved = true;
  const available = await button();
  assert.equal(available.props.disabled, false);
  available.props.onClick();
  assert.equal(starts, 1);
  harness.cleanup();
});
