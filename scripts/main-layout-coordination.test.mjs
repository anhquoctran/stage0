import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, loadWithMocks } from './helpers/componentHarness.mjs';

test('MR data reloads after its store actions are replaced while the Git repository stays selected', async () => {
  const harness = componentHarness();
  const repo = { id: 'repo-a', local_path: '/fixture/repo' };
  const git = { currentRepo: repo, baseBranch: 'main', branches: { local: ['main'], remote: [] } };
  const calls = [];
  const mr = {
    loadRepoData: async (...args) => { calls.push(['original', ...args]); },
    resetRepoData: () => { calls.push(['reset']); },
  };
  const { useMainLayoutCoordination } = loadWithMocks(new URL('../frontend/core/components/hooks/useMainLayoutCoordination.ts', import.meta.url), {
    react: harness.react,
    '../../../features/git/store/useGitStore': { useGitStore: () => git },
    '../../../features/virtual-mr/store/useVirtualMrStore': { useVirtualMrStore: () => mr },
    './useSidebarResizing': { useSidebarResizing: () => ({}) },
  });
  try {
    await harness.render(useMainLayoutCoordination);
    assert.deepEqual(calls, [['original', 'repo-a', '/fixture/repo', ['main'], 'main']]);
    // HMR replaces the MR store while retaining the Git store and repository.
    mr.loadRepoData = async (...args) => { calls.push(['replacement', ...args]); };
    await harness.render(useMainLayoutCoordination);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[1], ['replacement', 'repo-a', '/fixture/repo', ['main'], 'main']);
    await harness.render(useMainLayoutCoordination);
    assert.equal(calls.length, 2, 'ordinary renders do not reload saved MR state');
    git.currentRepo = null;
    await harness.render(useMainLayoutCoordination);
    assert.deepEqual(calls.at(-1), ['reset']);
  } finally {
    harness.cleanup();
  }
});
