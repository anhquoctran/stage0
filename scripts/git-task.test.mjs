import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function loadStore(relativePath, overrides = {}) {
  const source = fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  const exports = {};
  new Function('require', 'exports', outputText)((id) => overrides[id] ?? require(id), exports);
  return exports;
}

const { useGitTaskStore: tasks } = loadStore('../frontend/features/git/store/useGitTaskStore.ts');
let invokeHandler;
const { useGitStore: git } = loadStore('../frontend/features/git/store/useGitStore.ts', {
  '@tauri-apps/api/core': { invoke: (...args) => invokeHandler(...args) },
  './useGitTaskStore': { useGitTaskStore: tasks },
  '../services/createGitProgressChannel': { createGitProgressChannel: (taskId) => ({
    onmessage: (progress) => tasks.getState().updateTask(taskId, progress),
  }) },
});

function reset() {
  tasks.setState({ tasks: [], selectedTaskId: null, isBackgroundManagerOpen: false });
  git.setState({ currentRepo: { id: 'repo-a', name: 'A', local_path: '/repo/a' },
    isSyncing: false, isLoading: false, error: null,
    fetchBranches: async () => {}, loadDiff: async () => {},
    checkRebaseStatus: async () => false, loadRecentRepos: async () => {}, showToast: () => {},
  });
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

test('background task continues, terminal state ignores late progress, and dismiss never cancels work', () => {
  reset();
  const id = tasks.getState().startTask('merge', 'Merge', '/repo/a');
  tasks.getState().runInBackground(id);
  tasks.getState().dismissTask(id);
  assert.equal(tasks.getState().tasks.length, 1);
  tasks.getState().updateTask(id, { phase: 'Updating files', percent: 45, message: 'Updating files: 45%' });
  assert.equal(tasks.getState().tasks[0].progress, 45);
  tasks.getState().completeTask(id, 'Done');
  tasks.getState().updateTask(id, { phase: 'Working', percent: 20, message: 'Late message' });
  assert.equal(tasks.getState().tasks[0].status, 'succeeded');
  assert.equal(tasks.getState().tasks[0].progress, 100);
  assert.equal(tasks.getState().selectedTaskId, null);
  tasks.getState().showTask(id);
  tasks.getState().dismissTask(id);
  assert.equal(tasks.getState().tasks.length, 0);
});

test('duplicate repository tasks are rejected while independent tasks retain their own results', () => {
  reset();
  const first = tasks.getState().startTask('pull', 'Pull', '/repo/a');
  assert.throws(() => tasks.getState().startTask('rebase', 'Rebase', '/repo/a'));
  const second = tasks.getState().startTask('clone', 'Clone', '/repo/b');
  tasks.getState().runInBackground(first);
  assert.equal(tasks.getState().selectedTaskId, second);
  tasks.getState().failTask(first, 'Conflicts require attention');
  assert.equal(tasks.getState().tasks.find((task) => task.id === first).error, 'Conflicts require attention');
  tasks.getState().dismissTask(first);
  assert.equal(tasks.getState().selectedTaskId, second);
});

test('sync keeps executing after backgrounding and does not refresh another repository', async () => {
  reset();
  const command = deferred();
  let calls = 0;
  invokeHandler = (name, args) => {
    assert.equal(name, 'run_git_sync');
    calls += 1;
    args.onProgress.onmessage({ phase: 'Receiving objects', percent: 50, message: 'Receiving objects: 50%' });
    return command.promise;
  };
  let refreshes = 0;
  git.setState({ fetchBranches: async () => { refreshes += 1; }, loadDiff: async () => { refreshes += 1; } });
  const pending = git.getState().runSync('pull');
  const id = tasks.getState().tasks[0].id;
  await git.getState().runSync('merge');
  assert.equal(calls, 1);
  tasks.getState().runInBackground(id);
  git.setState({ currentRepo: { id: 'repo-b', name: 'B', local_path: '/repo/b' } });
  command.resolve('Already up to date.');
  await pending;
  assert.equal(refreshes, 0);
  assert.equal(tasks.getState().selectedTaskId, null);
  assert.equal(tasks.getState().tasks[0].status, 'succeeded');
  assert.equal(git.getState().isSyncing, false);
});

test('background clone opens its repository through the window manager and closes progress', async () => {
  reset();
  const command = deferred();
  const repo = { id: 'cloned', name: 'Cloned', local_path: '/clone/destination' };
  const calls = [];
  invokeHandler = (name, args) => {
    calls.push(name);
    if (name === 'clone_repository') return command.promise;
    assert.equal(name, 'open_repo_by_path');
    assert.equal(args.repoPath, repo.local_path);
    return { action: 'opened_new_window', repo, window_label: 'cloned-window' };
  };
  let refreshed = false;
  git.setState({ loadRecentRepos: async () => { refreshed = true; } });
  const pending = git.getState().cloneRepo('https://example.test/repo', '/clone/destination');
  tasks.getState().runInBackground(tasks.getState().tasks[0].id);
  command.resolve(repo);
  assert.deepEqual(await pending, repo);
  assert.equal(refreshed, true);
  assert.equal(git.getState().isLoading, false);
  assert.deepEqual(calls, ['clone_repository', 'open_repo_by_path']);
  assert.equal(tasks.getState().tasks.length, 0);
  assert.equal(tasks.getState().isBackgroundManagerOpen, false);
  assert.equal(git.getState().currentRepo.local_path, '/repo/a');
  assert.equal(tasks.getState().selectedTaskId, null);
});

test('failed background sync preserves the error and releases the busy state', async () => {
  reset();
  const command = deferred();
  invokeHandler = () => command.promise;
  const pending = git.getState().runSync('rebase');
  const id = tasks.getState().tasks[0].id;
  tasks.getState().runInBackground(id);
  command.reject('Git rebase failed: conflict');
  await pending;
  assert.equal(tasks.getState().tasks[0].status, 'failed');
  assert.match(tasks.getState().tasks[0].error, /conflict/);
  assert.equal(git.getState().isSyncing, false);
  assert.equal(tasks.getState().selectedTaskId, null);
});

test('backgrounding docks progress in the manager; closing and reopening never restores the modal', () => {
  reset();
  const id = tasks.getState().startTask('pull', 'Pull', '/repo/a');
  assert.equal(tasks.getState().selectedTaskId, id);
  tasks.getState().runInBackground(id);
  assert.equal(tasks.getState().selectedTaskId, null);
  assert.equal(tasks.getState().isBackgroundManagerOpen, true);
  assert.equal(tasks.getState().tasks[0].background, true);
  tasks.getState().setBackgroundManagerOpen(false);
  assert.equal(tasks.getState().tasks[0].status, 'running');
  tasks.getState().showTask(id);
  assert.equal(tasks.getState().isBackgroundManagerOpen, true);
  assert.equal(tasks.getState().selectedTaskId, null);
  tasks.getState().setBackgroundManagerOpen(false);
  tasks.getState().completeTask(id, 'Done');
  assert.equal(tasks.getState().isBackgroundManagerOpen, false);
  assert.equal(tasks.getState().selectedTaskId, null);
  tasks.getState().showTask(id);
  assert.equal(tasks.getState().isBackgroundManagerOpen, true);
  tasks.getState().dismissTask(id);
  assert.equal(tasks.getState().tasks.length, 0);
});

test('starting foreground work closes the manager without losing other background tasks', () => {
  reset();
  const backgroundId = tasks.getState().startTask('clone', 'Clone', '/repo/b');
  tasks.getState().runInBackground(backgroundId);
  const foregroundId = tasks.getState().startTask('merge', 'Merge', '/repo/a');
  assert.equal(tasks.getState().isBackgroundManagerOpen, false);
  assert.equal(tasks.getState().selectedTaskId, foregroundId);
  tasks.getState().runInBackground(backgroundId);
  assert.equal(tasks.getState().isBackgroundManagerOpen, false);
  assert.equal(tasks.getState().selectedTaskId, foregroundId);
  assert.equal(tasks.getState().tasks.find((task) => task.id === backgroundId).status, 'running');
  tasks.getState().runInBackground('missing');
  assert.equal(tasks.getState().selectedTaskId, foregroundId);
});

test('advanced clone options reach the backend unchanged and retain background execution', async () => {
  reset();
  const command = deferred();
  const options = { branch: 'feature/large', depth: 50, singleBranch: true, noTags: true,
    blobless: true, sparse: true, recurseSubmodules: true, shallowSubmodules: true,
    filterSubmodules: true, submoduleJobs: 8, skipLfs: true, timeoutMinutes: 120 };
  invokeHandler = (name, args) => {
    if (name === 'open_repo_by_path') {
      assert.equal(args.repoPath, '/clone/large');
      return { action: 'focused_existing', repo: {id:'large',name:'Large',local_path:'/clone/large'}, window_label: 'large-window' };
    }
    assert.equal(name, 'clone_repository');
    assert.deepEqual(args.options, options);
    assert.equal(args.credentialId, 'credential-id');
    args.onProgress.onmessage({ phase: 'Working', percent: null, message: 'Cloning submodule…' });
    return command.promise;
  };
  const pending = git.getState().cloneRepo('https://example.test/repo', '/clone/large', 'credential-id', options);
  tasks.getState().runInBackground(tasks.getState().tasks[0].id);
  const repo = {id:'large',name:'Large',local_path:'/clone/large'};
  command.resolve(repo);
  assert.deepEqual(await pending, repo);
  assert.equal(tasks.getState().tasks.length, 0);
  assert.equal(tasks.getState().selectedTaskId, null);
});

test('foreground clone attaches to an empty window and auto-dismisses only its own dialog', async () => {
  reset();
  git.setState({ currentRepo: null });
  const repo = {id:'cloned',name:'Cloned',local_path:'/clone/foreground'};
  const opening = deferred();
  const calls = [];
  invokeHandler = (name) => {
    calls.push(name);
    if (name === 'clone_repository') return repo;
    if (name === 'open_repo_by_path') return opening.promise;
    assert.equal(name, 'window_maximize');
  };
  const pending = git.getState().cloneRepo('https://example.test/repo', repo.local_path);
  await new Promise((resolve) => setImmediate(resolve));
  const cloneId = tasks.getState().tasks[0].id;
  assert.equal(tasks.getState().tasks[0].phase, 'Opening repository');
  const anotherId = tasks.getState().startTask('pull', 'Pull', '/another/repo');
  opening.resolve({ action: 'opened_here', repo });
  await pending;
  assert.equal(git.getState().currentRepo.local_path, repo.local_path);
  assert.equal(git.getState().isLoading, false);
  assert.ok(!tasks.getState().tasks.some((task) => task.id === cloneId));
  assert.equal(tasks.getState().selectedTaskId, anotherId);
  assert.deepEqual(calls, ['clone_repository', 'open_repo_by_path', 'window_maximize']);
});

test('auto-open still routes after switching repo while a clone is running', async () => {
  reset();
  const command = deferred();
  const repo = {id:'cloned',name:'Cloned',local_path:'/clone/switched'};
  let opened = false;
  invokeHandler = (name, args) => {
    if (name === 'clone_repository') return command.promise;
    assert.equal(name, 'open_repo_by_path');
    assert.equal(args.repoPath, repo.local_path);
    opened = true;
    return { action: 'opened_new_window', repo, window_label: 'new-window' };
  };
  const pending = git.getState().cloneRepo('https://example.test/repo', repo.local_path);
  git.setState({ currentRepo: {id:'switched',name:'Switched',local_path:'/repo/switched'} });
  command.resolve(repo);
  await pending;
  assert.equal(opened, true);
  assert.equal(git.getState().currentRepo.local_path, '/repo/switched');
  assert.equal(tasks.getState().selectedTaskId, null);
  assert.equal(tasks.getState().tasks.length, 0);
});

test('clone and auto-open errors remain visible rather than silently dismissing', async () => {
  for (const cloneSucceeded of [false, true]) {
    reset();
    const repo = {id:'saved',name:'Saved',local_path:'/clone/saved'};
    invokeHandler = (name) => {
      if (name === 'clone_repository' && cloneSucceeded) return repo;
      throw new Error('Fixture failure');
    };
    await assert.rejects(git.getState().cloneRepo('https://example.test/repo', repo.local_path), /Fixture failure/);
    assert.equal(tasks.getState().tasks[0].status, 'failed');
    assert.equal(tasks.getState().selectedTaskId, tasks.getState().tasks[0].id);
    if (cloneSucceeded) assert.match(tasks.getState().tasks[0].error, /was cloned to '\/clone\/saved'.*could not be opened automatically/);
  }
});
