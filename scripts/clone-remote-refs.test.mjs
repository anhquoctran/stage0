import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';

const helpers = loadWithMocks(new URL('../frontend/features/git/utils/cloneRefOptions.ts', import.meta.url), {});
const refs = { defaultBranch: 'main', branches: ['feature/test', 'main'], tags: ['v1', 'v2'] };

test('branch/tag options preserve the remote default and group every advertised ref', () => {
  const options = helpers.cloneRefOptions(refs);
  assert.equal(options[0].value, '');
  assert.match(options[0].label, /main/);
  assert.deepEqual(options.slice(1).map((option) => [option.value, option.group]), [
    ['feature/test', 'Branches'], ['main', 'Branches'], ['v1', 'Tags'], ['v2', 'Tags'],
  ]);
  assert.equal(options.find((option) => option.value === 'main').badge, 'default');
  assert.equal(helpers.cloneRefOptions({ defaultBranch: null, branches: [], tags: [] }).length, 1);
  const collision = helpers.cloneRefOptions({ defaultBranch: 'main', branches: ['main'], tags: ['main'] });
  assert.equal(new Set(collision.map((option) => option.value)).size, collision.length);
  assert.equal(collision.find((option) => option.group === 'Tags').disabled, true);
});

test('common dropdown searches large ref lists and keyboard selection uses filtered rows', async () => {
  const originalDocument = globalThis.document;
  globalThis.document = { addEventListener() {}, removeEventListener() {} };
  const harness = componentHarness();
  const { CustomSelect } = loadWithMocks(new URL('../frontend/common/components/CustomSelect.tsx', import.meta.url), {
    react: harness.react, './icons/ChevronDown': { ChevronDown() {} }, './icons/Check': { Check() {} },
  });
  let selected;
  const props = { value: '', options: Array.from({ length: 500 }, (_, i) => ({ value: `branch-${i}`, label: `branch-${i}` })),
    searchable: true, onChange: (value) => { selected = value; } };
  try {
    let tree = await harness.render(CustomSelect, props);
    componentNodes(tree).find((node) => node.type === 'button').props.onClick();
    tree = await harness.render(CustomSelect, props);
    assert.equal(componentNodes(tree).filter((node) => node.props?.role === 'option').length, 200);
    componentNodes(tree).find((node) => node.type === 'input').props.onChange({ target: { value: 'branch-499' } });
    tree = await harness.render(CustomSelect, props);
    assert.equal(componentNodes(tree).filter((node) => node.props?.role === 'option').length, 1);
    tree.props.onKeyDown({ target: { tagName: 'INPUT' }, key: 'Enter', preventDefault() {} });
    assert.equal(selected, 'branch-499');
    tree = await harness.render(CustomSelect, props);
    assert.ok(!componentNodes(tree).some((node) => node.props?.role === 'listbox'));
  } finally {
    harness.cleanup();
    globalThis.document = originalDocument;
  }
});

test('URL validation debounces ref discovery, ignores stale responses and supports selected credentials', async () => {
  const originalWindow = globalThis.window;
  const originalTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const timers = new Map();
  let timerId = 0;
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  globalThis.setTimeout = (callback) => { timers.set(++timerId, callback); return timerId; };
  globalThis.clearTimeout = (id) => timers.delete(id);
  const harness = componentHarness();
  const cloneOptions = loadWithMocks(new URL('../frontend/features/git/utils/cloneOptions.ts', import.meta.url), {});
  const nameHelpers = loadWithMocks(new URL('../frontend/features/git/utils/cloneDestination.ts', import.meta.url), {});
  const calls = [];
  const pending = [];
  const git = { isCloneModalOpen: true, setIsCloneModalOpen() {}, cloneRepo: async () => {}, pickCloneFolder: async () => null };
  const credentials = { isLoading: false, fetchCredentials: async () => {}, credentials: [
    { id: 'saved', is_in_keyring: true, token_type: 'token', source: 'stage0', server_url: 'https://example.test', account_name: 'Fixture' },
  ] };
  function CloneOptionsForm() {}
  function CustomSelect() {}
  const fallback = new Proxy({}, { get: () => () => null });
  const { CloneRepoModal } = loadWithMocks(new URL('../frontend/features/git/components/CloneRepoModal.tsx', import.meta.url), new Proxy({
    react: harness.react,
    '@tauri-apps/api/core': { invoke: (name, args) => {
      calls.push([name, args]);
      return new Promise((resolve, reject) => pending.push({ resolve, reject }));
    } },
    '@tauri-apps/api/event': { listen: async () => () => {} },
    '@tauri-apps/api/path': { homeDir: async () => '/home/test' },
    '../store/useGitStore': { useGitStore: () => git },
    '../store/useGitTaskStore': { useGitTaskStore: (selector) => selector({ tasks: [] }) },
    '../../credentials/store/useGitCredentialsStore': { useGitCredentialsStore: (selector) => selector(credentials) },
    '../utils/cloneOptions': cloneOptions,
    '../utils/cloneDestination': nameHelpers,
    '../services/resolveCloneDestination': { resolveCloneDestination: async (parent, name) => name ? `${parent}/${name}` : '' },
    './CloneOptionsForm': { CloneOptionsForm },
    '../../../common/components/CustomSelect': { CustomSelect },
  }, { get: (target, key) => target[key] ?? fallback }));
  const find = (tree, predicate) => componentNodes(tree).find(predicate);
  const refForm = (tree) => find(tree, (node) => node.type === CloneOptionsForm).props;
  const changeUrl = (tree, value) => find(tree, (node) => node.type === 'input' && node.props.autoFocus).props.onChange({ target: { value } });
  const runTimer = () => { const [id, callback] = [...timers.entries()][0]; timers.delete(id); return callback(); };
  try {
    let tree = await harness.render(CloneRepoModal);
    changeUrl(tree, 'https://example.test/first.git');
    tree = await harness.render(CloneRepoModal);
    changeUrl(tree, 'https://example.test/second.git');
    tree = await harness.render(CloneRepoModal);
    assert.equal(timers.size, 1);
    assert.equal(calls.length, 0);
    const staleRequest = runTimer();
    assert.deepEqual(calls[0], ['get_clone_remote_refs', { url: 'https://example.test/second.git', credentialId: null }]);
    changeUrl(tree, 'https://example.test/current.git');
    tree = await harness.render(CloneRepoModal);
    const currentRequest = runTimer();
    pending[1].resolve(refs);
    await currentRequest;
    tree = await harness.render(CloneRepoModal);
    assert.deepEqual(refForm(tree).remoteRefs, refs);
    assert.equal(refForm(tree).refsLoading, false);
    pending[0].reject('Old request failed');
    await staleRequest;
    tree = await harness.render(CloneRepoModal);
    assert.deepEqual(refForm(tree).remoteRefs, refs);
    find(tree, (node) => node.type === 'input' && node.props.type === 'checkbox').props.onChange({ target: { checked: true } });
    tree = await harness.render(CloneRepoModal);
    assert.equal(timers.size, 0);
    find(tree, (node) => node.type === CustomSelect).props.onChange('saved');
    tree = await harness.render(CloneRepoModal);
    const authenticatedRequest = runTimer();
    assert.deepEqual(calls[2], ['get_clone_remote_refs', { url: 'https://example.test/current.git', credentialId: 'saved' }]);
    pending[2].resolve({ branches: [], tags: [], defaultBranch: null });
    await authenticatedRequest;
    tree = await harness.render(CloneRepoModal);
    assert.deepEqual(refForm(tree).remoteRefs.branches, []);
    git.isCloneModalOpen = false;
    await harness.render(CloneRepoModal);
    assert.equal(timers.size, 0);
  } finally {
    harness.cleanup();
    globalThis.window = originalWindow;
    globalThis.setTimeout = originalTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});
