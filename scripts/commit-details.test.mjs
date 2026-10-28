import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';

const deferred = () => { let resolve, reject; const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; }); return { promise, resolve, reject }; };

test('commit rows open details for the exact immutable hash and cannot leak into another MR', async () => {
  const harness = componentHarness();
  const repo = { id: 'repo', local_path: '/fixture/repo' };
  const Modal = () => null;
  const { VirtualMrCommitsTab } = loadWithMocks(new URL('../frontend/features/virtual-mr/components/hub/VirtualMrCommitsTab.tsx', import.meta.url), {
    react: harness.react,
    '../../../git/store/useGitStore': { useGitStore: selector => selector({ currentRepo: repo }) },
    '../../../git/components/CommitDetailsModal': { CommitDetailsModal: Modal },
    '../../../../common/components/icons/GitCommit': { GitCommit: () => null },
    '../../../../common/utils/dateTime': { formatDateTime: value => value },
  });
  const session = { id: 'mr', repoId: 'repo', commits: [
    { hash: 'a'.repeat(40), shortHash: 'aaaaaaa', subject: 'First change' },
    { hash: 'b'.repeat(40), shortHash: 'bbbbbbb', subject: 'Second change' },
  ] };
  try {
    let nodes = componentNodes(await harness.render(VirtualMrCommitsTab, { session }));
    nodes.find(node => node.props['aria-label'] === 'View commit bbbbbbb: Second change').props.onClick();
    nodes = componentNodes(await harness.render(VirtualMrCommitsTab, { session }));
    let modal = nodes.find(node => node.type === Modal);
    assert.equal(modal.props.commitHash, 'b'.repeat(40));
    assert.equal(modal.props.repoPath, '/fixture/repo');
    modal.props.onClose();
    nodes = componentNodes(await harness.render(VirtualMrCommitsTab, { session }));
    assert.equal(nodes.some(node => node.type === Modal), false);
    nodes.find(node => node.props['aria-label'] === 'View commit aaaaaaa: First change').props.onClick();
    nodes = componentNodes(await harness.render(VirtualMrCommitsTab, { session: { ...session, id: 'another-mr' } }));
    assert.equal(nodes.some(node => node.type === Modal), false);
  } finally { harness.cleanup(); }
});

test('late commit responses cannot overwrite a different commit or repository, and errors can be retried', async () => {
  const harness = componentHarness();
  const requests = [];
  const services = { gitHistory: { getGitCommitDetails: input => {
    const pending = deferred(); requests.push({ input, ...pending }); return pending.promise;
  } } };
  const { useCommitDetails } = loadWithMocks(new URL('../frontend/features/git/hooks/useCommitDetails.ts', import.meta.url), {
    react: harness.react,
    '../../../core/services/runtime/useApplicationServices': { useApplicationServices: () => services },
  });
  let repoPath = '/repo-a', commitHash = 'a'.repeat(40);
  const render = () => harness.render(() => useCommitDetails(repoPath, commitHash));
  try {
    assert.equal((await render()).loading, true);
    commitHash = 'b'.repeat(40);
    await render();
    requests[1].resolve({ hash: commitHash });
    let state = await render();
    assert.equal(state.data.hash, commitHash);
    requests[0].resolve({ hash: 'a'.repeat(40) });
    assert.equal((await render()).data.hash, commitHash);
    repoPath = '/repo-b';
    state = await render();
    assert.equal(state.loading, true);
    assert.equal(state.data, null);
    requests[2].reject(new Error('Commit object unavailable'));
    state = await render();
    assert.match(state.error, /unavailable/);
    state.retry();
    assert.equal((await render()).loading, true);
    requests[3].resolve({ hash: commitHash, message: 'Full message' });
    assert.equal((await render()).data.message, 'Full message');
    assert.deepEqual(requests[3].input, { repoPath: '/repo-b', commitHash });
  } finally { harness.cleanup(); }
});

test('commit file previews use only the selected file hunks and cannot create MR discussions', async () => {
  const harness = componentHarness();
  const DiffView = () => null;
  const { CommitFileDiff } = loadWithMocks(new URL('../frontend/features/git/components/CommitFileDiff.tsx', import.meta.url), {
    react: harness.react,
    '@git-diff-view/react': { DiffView, DiffModeEnum: { Unified: 2 } },
    '../../../core/store/useThemeStore': { useThemeStore: selector => selector({ theme: 'mocha' }) },
  });
  const rawDiff = 'diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1 +1 @@\n-old\n+new\n'
    + 'diff --git a/b.ts b/b.ts\n--- a/b.ts\n+++ b/b.ts\n@@ -1 +1 @@\n-other\n+unrelated\n';
  const file = { path: 'a.ts', status: 'MODIFIED', additions: 1, deletions: 1, is_binary: false };
  try {
    let nodes = componentNodes(await harness.render(CommitFileDiff, { file, rawDiff }));
    const viewer = nodes.find(node => node.type === DiffView);
    assert.ok(viewer.props.data.hunks[0].includes('+new'));
    assert.ok(!viewer.props.data.hunks[0].includes('unrelated'));
    assert.equal(viewer.props.diffViewAddWidget, undefined);
    nodes = componentNodes(await harness.render(CommitFileDiff, { file: { ...file, is_binary: true }, rawDiff }));
    assert.equal(nodes.some(node => node.type === DiffView), false);
  } finally { harness.cleanup(); }
});
