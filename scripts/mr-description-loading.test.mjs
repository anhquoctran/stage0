import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';

function setup() {
  const runner = componentHarness();
  const state = { reviewBatches: {} };
  const Editor = () => null;
  const Preview = () => null;
  const noop = () => null;
  const mrStore = { consumeDescriptionEditRequest: () => false, updateSessionDetails: noop };
  const { VirtualMrOverviewTab } = loadWithMocks(new URL('../frontend/features/virtual-mr/components/hub/VirtualMrOverviewTab.tsx', import.meta.url), {
    react: runner.react,
    '../../../../common/components/MarkdownEditor': { MarkdownEditor: Editor },
    '../../../../common/components/MarkdownPreview': { MarkdownPreview: Preview },
    '../../../git/store/useGitStore': { useGitStore: () => ({ showToast: noop }) },
    '../../../review/store/useReviewStore': { useReviewStore: (selector) => selector(state) },
    '../../store/useVirtualMrStore': { useVirtualMrStore: () => mrStore },
    '../../utils/discussionMentions': { getDiscussionMentionOptions: () => [] },
    '../overview/VirtualMrActivityTimeline': { VirtualMrActivityTimeline: noop },
    '../overview/VirtualMrMergeDetails': { VirtualMrMergeDetails: noop },
    '../overview/VirtualMrOverviewSidebar': { VirtualMrOverviewSidebar: noop },
  });
  const session = { id: 'mr-1', title: 'Example', description: 'Existing description', commits: [] };
  return { state, Editor, Preview, session,
    render: async () => componentNodes(await runner.render(VirtualMrOverviewTab, { session })) };
}
const editButton = (nodes) => nodes.find((node) => node.type === 'button' && node.props.children.includes('Edit Description'));

test('description skeleton is scoped to its MR and disappears when content is ready or generation fails', async () => {
  const fixture = setup();
  fixture.state.reviewBatches.other = { phase: 'preparing-description' };
  let nodes = await fixture.render();
  assert.ok(editButton(nodes));
  editButton(nodes).props.onClick();
  assert.ok((await fixture.render()).some((node) => node.type === fixture.Editor && node.props.value === 'Existing description'));

  fixture.state.reviewBatches['mr-1'] = { phase: 'preparing-description' };
  nodes = await fixture.render();
  assert.ok(nodes.some((node) => node.props.role === 'status' && node.props['aria-busy'] === 'true'));
  assert.equal(editButton(nodes), undefined);
  assert.ok(!nodes.some((node) => node.type === fixture.Preview));
  assert.ok(!nodes.some((node) => node.type === fixture.Editor && node.props.value === 'Existing description'));

  fixture.session.description = 'Generated description';
  fixture.state.reviewBatches['mr-1'] = { phase: 'reviewing' };
  nodes = await fixture.render();
  assert.ok(editButton(nodes));
  assert.ok(nodes.some((node) => node.type === fixture.Preview && node.props.content === 'Generated description'));
  assert.ok(!nodes.some((node) => node.props['aria-busy'] === 'true'));

  fixture.state.reviewBatches['mr-1'] = { phase: 'preparing-description' };
  await fixture.render();
  delete fixture.state.reviewBatches['mr-1'];
  nodes = await fixture.render();
  assert.ok(editButton(nodes));
  assert.ok(nodes.some((node) => node.type === fixture.Preview && node.props.content === 'Generated description'));
});
