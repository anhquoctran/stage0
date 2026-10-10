import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

function load(relative, dependencies = {}) {
  const { outputText } = ts.transpileModule(fs.readFileSync(new URL(relative, import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  });
  const exports = {};
  new Function('require', 'exports', outputText)((id) => dependencies[id], exports);
  return exports;
}
const helpers = load('../frontend/features/git/utils/cloneDestination.ts');

test('infers portable directory names from HTTPS, SSH and scp URLs', () => {
  for (const url of [
    'https://github.com/microsoft/TypeScript.git',
    'https://github.com/microsoft/TypeScript.git/?ref=main#readme',
    'git@github.com:microsoft/TypeScript.git',
    'ssh://git@github.com:22/microsoft/TypeScript.git',
    'git@github.com:TypeScript.git',
  ]) assert.equal(helpers.extractCloneRepoName(url), 'TypeScript');
  assert.equal(helpers.extractCloneRepoName('https://example.test/a/My%20Repo.git'), 'My-Repo');
  assert.equal(helpers.extractCloneRepoName(''), '');
  assert.equal(helpers.extractCloneRepoName('https://example.test/'), '');
  assert.equal(helpers.extractCloneRepoName('invalid'), '');
});

test('sanitizes traversal, separators, control characters and Windows device names', () => {
  for (const name of ['..', '.', '../escape', 'a/b', 'a\\b', 'a:b', 'a\u0000b', 'a\nb', 'CON', 'nul.txt', 'COM1', 'LPT9.txt', '-option', 'trailing.', ' ']) {
    const safe = helpers.sanitizeCloneRepoName(name);
    assert.ok(helpers.isSafeCloneRepoName(safe), name);
    assert.equal(helpers.isSafeCloneRepoName(name), false, name);
    assert.ok(!safe.includes('/') && !safe.includes('\\'));
  }
  assert.equal(helpers.sanitizeCloneRepoName('CON'), 'repo-CON');
  assert.equal(helpers.sanitizeCloneRepoName('..'), 'repository');
  assert.ok(helpers.sanitizeCloneRepoName('a'.repeat(300)).length <= 120);
  assert.ok(helpers.isSafeCloneRepoName('TypeScript'));
  assert.ok(helpers.isSafeCloneRepoName('my_repo.v2'));
});

test('native joining preserves Unix roots, Windows drive roots and UNC paths', async () => {
  for (const [nativePath, parent, expected] of [
    [path.posix, '/Users/test', '/Users/test/TypeScript'],
    [path.posix, '/home/test/', '/home/test/TypeScript'],
    [path.posix, '/', '/TypeScript'],
    [path.win32, 'C:\\Users\\test', 'C:\\Users\\test\\TypeScript'],
    [path.win32, 'C:\\', 'C:\\TypeScript'],
    [path.win32, '\\\\server\\share\\', '\\\\server\\share\\TypeScript'],
  ]) {
    const { resolveCloneDestination } = load('../frontend/features/git/services/resolveCloneDestination.ts', {
      '@tauri-apps/api/path': { isAbsolute: async (value) => nativePath.isAbsolute(value), join: async (...parts) => nativePath.join(...parts) },
      '../utils/cloneDestination': helpers,
    });
    assert.equal(await resolveCloneDestination(parent, 'TypeScript'), expected);
    assert.equal(await resolveCloneDestination(parent, '..'), '');
    assert.equal(await resolveCloneDestination(parent, 'a/b'), '');
    assert.equal(await resolveCloneDestination(parent, ''), '');
    assert.equal(await resolveCloneDestination('', 'TypeScript'), '');
    assert.equal(await resolveCloneDestination('relative-parent', 'TypeScript'), '');
  }
});

test('clone form defaults to native home rather than a previously stored directory', () => {
  const source = fs.readFileSync(new URL('../frontend/features/git/components/CloneRepoModal.tsx', import.meta.url), 'utf8');
  assert.ok(source.includes('homeDir().then('));
  assert.ok(source.includes('current || directory'));
  assert.ok(source.includes('if (!repoNameEdited) {'));
  assert.ok(source.includes('extractCloneRepoName(val)'));
  assert.ok(source.includes("if (inferred !== repoName) setDestinationPath('')"));
  assert.ok(!source.includes('stage0_last_clone_dir'));
});

test('destination input displays the full joined path and submits that exact path', async () => {
  const originalWindow = globalThis.window;
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  const slots = [];
  let cursor = 0;
  let effects = [];
  let tree;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, (next) => {
        slots[index].value = typeof next === 'function' ? next(slots[index].value) : next;
      }];
    },
    useMemo: (callback) => callback(),
    useEffect(callback, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || dependencies.some((value, i) => value !== previous.dependencies[i])) {
        previous?.cleanup?.();
        slots[index] = { dependencies };
        effects.push(() => { slots[index].cleanup = callback(); });
      }
    },
  };
  const fallback = new Proxy({}, { get: () => () => null });
  const options = load('../frontend/features/git/utils/cloneOptions.ts');
  const { resolveCloneDestination } = load('../frontend/features/git/services/resolveCloneDestination.ts', {
    '@tauri-apps/api/path': { isAbsolute: async (value) => path.posix.isAbsolute(value), join: async (...parts) => path.posix.join(...parts) },
    '../utils/cloneDestination': helpers,
  });
  let submitted;
  const git = { isCloneModalOpen: true, setIsCloneModalOpen() {},
    cloneRepo: async (...args) => { submitted = args; }, pickCloneFolder: async () => '/Projects' };
  const credentials = { credentials: [], isLoading: false, fetchCredentials: async () => {} };
  const dependencies = new Proxy({
    react: { ...react, default: react },
    '@tauri-apps/api/core': { invoke: async () => 'Repository is valid and ready to clone.' },
    '@tauri-apps/api/event': { listen: async () => () => {} },
    '@tauri-apps/api/path': { homeDir: async () => '/Users/test' },
    '../store/useGitStore': { useGitStore: () => git },
    '../store/useGitTaskStore': { useGitTaskStore: (selector) => selector({ tasks: [] }) },
    '../../credentials/store/useGitCredentialsStore': { useGitCredentialsStore: (selector) => selector(credentials) },
    '../utils/cloneOptions': options,
    '../utils/cloneDestination': helpers,
    '../services/resolveCloneDestination': { resolveCloneDestination },
  }, { get: (target, key) => target[key] ?? fallback });
  const { CloneRepoModal } = load('../frontend/features/git/components/CloneRepoModal.tsx', dependencies);
  async function render() {
    for (let iteration = 0; iteration < 6; iteration++) {
      cursor = 0;
      tree = CloneRepoModal();
      const pending = effects;
      effects = [];
      pending.forEach((effect) => effect());
      await new Promise((resolve) => setImmediate(resolve));
    }
  }
  function find(predicate, node = tree) {
    if (!node || typeof node !== 'object') return null;
    if (predicate(node)) return node;
    for (const child of [node.props?.children].flat(Infinity)) {
      const result = find(predicate, child);
      if (result) return result;
    }
    return null;
  }
  const destination = () => find((node) => node.props?.['aria-label'] === 'Destination Directory');
  const url = () => find((node) => node.type === 'input' && node.props?.autoFocus);
  try {
    await render();
    assert.equal(destination().props.value, '/Users/test');
    url().props.onChange({ target: { value: 'https://github.com/microsoft/TypeScript.git' } });
    await render();
    assert.equal(destination().props.value, '/Users/test/TypeScript');
    url().props.onChange({ target: { value: 'https://github.com/another/TypeScript.git' } });
    await render();
    assert.equal(destination().props.value, '/Users/test/TypeScript');
    await find((node) => node.props?.title === 'Choose a parent folder for the repository').props.onClick();
    await render();
    assert.equal(destination().props.value, '/Projects/TypeScript');
    await find((node) => node.props?.title === 'Choose a parent folder for the repository').props.onClick();
    await render();
    assert.equal(destination().props.value, '/Projects/TypeScript');
    find((node) => node.type === 'input' && node.props?.placeholder === 'e.g. my-project')
      .props.onChange({ target: { value: 'custom-name' } });
    await render();
    assert.equal(destination().props.value, '/Projects/custom-name');
    await find((node) => node.type === 'form').props.onSubmit({ preventDefault() {} });
    assert.equal(submitted[1], '/Projects/custom-name');
  } finally {
    slots.forEach((slot) => slot?.cleanup?.());
    globalThis.window = originalWindow;
  }
});
