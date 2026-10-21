import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';

const search = loadWithMocks(new URL('../frontend/features/virtual-mr/utils/virtualMrSearch.ts', import.meta.url), {});
const text = (node) => [node.props?.children].flat(Infinity).filter((value) => typeof value === 'string' || typeof value === 'number').join('');

async function fixture(inline = true) {
  const harness = componentHarness();
  const selected = [];
  const git = { currentRepo: { id: 'repo-a', name: 'Repo A', local_path: '/a' },
    showToast() {}, setBranchComparison: async () => {} };
  const state = {
    isLoadingSessions: false, isMrListOpen: !inline, setIsMrListOpen() {}, openNewMrDraft() {},
    switchSession: (id) => selected.push(id),
    sessions: Array.from({ length: 45 }, (_, index) => ({
      id: `mr-${index}`, title: `MR ${String(index).padStart(2, '0')}`, status: 'open',
      description: '', baseBranch: 'main', compareBranch: `feature-${index}`,
      createdAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
      updatedAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
      labels: [], discussions: [], reviewers: [], assignee: { name: 'User', email: 'user@test' },
    })),
  };
  const { VirtualMrListDialog } = loadWithMocks(new URL('../frontend/features/virtual-mr/components/VirtualMrListDialog.tsx', import.meta.url), {
    react: harness.react,
    '../../git/store/useGitStore': { useGitStore: () => git },
    '../store/useVirtualMrStore': { useVirtualMrStore: () => state },
    '../utils/virtualMrSearch': search,
    '../../../common/utils/dateTime': { formatDateTime: (value) => value, formatRecentTime: () => 'Today' },
    '../../../common/components/CustomSelect': { CustomSelect() {} },
    ...Object.fromEntries(['CheckCircle2', 'ChevronLeft', 'ChevronRight', 'GitBranch', 'GitPullRequest', 'Loader2',
      'MessageSquare', 'Plus', 'Search', 'SortAscending', 'SortDescending', 'Tag', 'User', 'X']
      .map((name) => [`../../../common/components/icons/${name}`, { [name]: name }])),
  });
  let nodes;
  const render = async () => { nodes = componentNodes(await harness.render(VirtualMrListDialog, { inline })); };
  const labelled = (label) => nodes.find((node) => node.props?.['aria-label'] === label);
  const rows = () => nodes.filter((node) => node.type === 'button' && node.props.className?.startsWith('group '));
  const showing = () => text(nodes.find((node) => node.props?.role === 'status'));
  const click = async (label) => { labelled(label).props.onClick(); await render(); };
  await render();
  return { state, git, selected, render, labelled, rows, showing, click };
}

for (const inline of [true, false]) {
  test(`MR pagination covers every result once and opens the selected MR (${inline ? 'inline' : 'dialog'})`, async (t) => {
    if (!inline) {
      const originalWindow = globalThis.window;
      globalThis.window = { addEventListener() {}, removeEventListener() {} };
      t.after(() => { globalThis.window = originalWindow; });
    }
    const view = await fixture(inline);
    assert.equal(view.showing(), 'Showing 1–20 of 45');
    assert.equal(view.labelled('Previous page').props.disabled, true);
    const seen = [];
    for (let page = 1; page <= 3; page++) {
      const rows = view.rows();
      assert.equal(rows.length, page === 3 ? 5 : 20);
      seen.push(...rows.map((row) => row.props.key));
      if (page < 3) await view.click('Next page');
    }
    assert.equal(new Set(seen).size, 45);
    assert.equal(view.showing(), 'Showing 41–45 of 45');
    assert.equal(view.labelled('Next page').props.disabled, true);
    await view.rows()[0].props.onClick();
    assert.deepEqual(view.selected, ['mr-4']);
    await view.click('Previous page');
    assert.equal(view.showing(), 'Showing 21–40 of 45');
  });
}

test('search and sort run across all MRs before pagination and reset to the first page', async () => {
  const view = await fixture();
  await view.click('Next page');
  view.labelled('Search merge requests').props.onChange({ target: { value: 'MR 00', selectionStart: 5, scrollLeft: 0 } });
  await view.render();
  assert.equal(view.showing(), 'Showing 1–1 of 1');
  assert.equal(view.rows()[0].props.key, 'mr-0');
  assert.equal(view.labelled('Merge request pagination'), undefined);
  view.labelled('Search merge requests').props.onChange({ target: { value: '', selectionStart: 0, scrollLeft: 0 } });
  await view.render();
  await view.click('Next page');
  view.labelled('Sort merge requests').props.onChange('title');
  await view.render();
  assert.equal(view.showing(), 'Showing 1–20 of 45');
  assert.equal(view.rows()[0].props.key, 'mr-0');
});

test('page size and repository changes reset navigation; shrinking and empty results stay valid', async () => {
  const view = await fixture();
  await view.click('Next page');
  view.labelled('Merge requests per page').props.onChange('50');
  await view.render();
  assert.equal(view.rows().length, 45);
  assert.equal(view.showing(), 'Showing 1–45 of 45');
  assert.equal(view.labelled('Merge request pagination'), undefined);
  view.labelled('Merge requests per page').props.onChange('20');
  await view.render();
  assert.ok(view.labelled('Merge request pagination'));
  await view.click('Next page');
  await view.click('Next page');
  view.state.sessions = view.state.sessions.slice(0, 25);
  await view.render();
  assert.equal(view.showing(), 'Showing 21–25 of 25');
  view.git.currentRepo = { ...view.git.currentRepo, id: 'repo-b' };
  await view.render();
  assert.equal(view.showing(), 'Showing 1–20 of 25');
  view.state.sessions = [];
  await view.render();
  assert.equal(view.showing(), 'Showing 0–0 of 0');
  assert.equal(view.labelled('Merge request pagination'), undefined);
  assert.equal(view.labelled('Previous page'), undefined);
  assert.equal(view.labelled('Next page'), undefined);
});
