import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { loadWithMocks, componentHarness, componentNodes } from './helpers/componentHarness.mjs';
import { hookHarness } from './helpers/hookHarness.mjs';

const config = JSON.parse(fs.readFileSync(new URL('../shared/application-menu.json', import.meta.url), 'utf8'));
const constants = loadWithMocks(new URL('../frontend/core/constants/applicationMenu.ts', import.meta.url), {});
const shortcuts = loadWithMocks(new URL('../frontend/core/services/applicationMenuShortcuts.ts', import.meta.url), {});

function actionIds(nodes, platform) {
  return constants.menuNodesForPlatform(nodes, platform).flatMap((node) => [
    ...(node.command ? [node.command] : []), ...actionIds(node.items || [], platform),
  ]);
}

test('Windows, Linux and macOS share application menu order, actions, labels and shortcuts', () => {
  const common = (platform) => constants.menuNodesForPlatform(config.menus, platform)
    .filter((node) => !['application_menu', 'window_menu'].includes(node.id)).map((node) => node.id);
  assert.deepEqual(common('windows'), common('linux'));
  assert.deepEqual(common('windows'), common('macos'));
  const applicationIds = (platform) => [...new Set(actionIds(config.menus, platform))]
    .filter((id) => !config.commands[id].native && !['exit', 'zoom'].includes(id)).sort();
  assert.deepEqual(applicationIds('windows'), applicationIds('macos'));
  assert.deepEqual(applicationIds('windows'), applicationIds('linux'));
  assert.equal(constants.menuLabel('Open in {fileManager}', 'Finder'), 'Open in Finder');
  assert.equal(constants.menuShortcut('close_window'), 'CmdOrCtrl+Shift+W');
  assert.equal(config.commands.open_vscode.icon, 'VsCode');
  assert.ok(applicationIds('macos').includes('release_notes'));
  assert.ok(applicationIds('macos').includes('rebase_abort'));
});

test('all configured separators are normalized and shortcut help follows the same config', () => {
  for (const platform of ['windows', 'macos', 'linux']) {
    function walk(nodes) {
      const visible = constants.menuNodesForPlatform(nodes, platform);
      assert.ok(!visible[0]?.separator && !visible.at(-1)?.separator);
      for (let i = 1; i < visible.length; i++) assert.ok(!visible[i].separator || !visible[i - 1].separator);
      visible.forEach((node) => walk(node.items || []));
    }
    walk(config.menus);
    const categories = shortcuts.getMenuShortcutCategories(platform, 'File Manager');
    const ids = actionIds(config.menus, platform);
    for (const id of ids) {
      const command = config.commands[id];
      if (command.shortcut) assert.ok(categories.some((category) => category.items.some((item) =>
        item.label === constants.menuLabel(command.label, 'File Manager'))), id);
    }
  }
});

function fixture() {
  const calls = [];
  const action = (name) => (...args) => { calls.push([name, ...args]); };
  const git = { currentRepo: { id: 'r', local_path: '/repo', name: 'Repo' }, selectedFile: null,
    recentRepos: [], isSyncing: false, isRebasing: false, viewMode: 'split', fileViewTab: 'diff', fileListLayout: 'flat',
    runSync: action('sync'), showToast: action('toast'), setIsRepoOverviewOpen: action('overview'),
    setIsPullFromOpen: action('pull-from'), selectRepo: action('selectRepo'), removeRecentRepo: action('removeRecentRepo'),
    setFileViewTab: action('file-tab'), fetchFileBlame: action('blame'), setViewMode: action('view'),
  };
  const store = (state) => Object.assign((selector) => selector ? selector(state) : state, { getState: () => state });
  const prefs = { showInlineBlame: false, setIsPreferencesOpen: action('preferences') };
  const perf = { isEnabled: false, toggle: action('performance') };
  const dependencies = {
    '../../features/git/store/useGitStore': { useGitStore: store(git) },
    '../../features/virtual-mr/store/useVirtualMrStore': { useVirtualMrStore: store({}) },
    '../../features/preferences/store/usePreferencesStore': { usePreferencesStore: store(prefs) },
    '../../features/performance/store/usePerformanceMonitorStore': { usePerformanceMonitorStore: store(perf) },
    '../store/useThemeStore': { useThemeStore: store({}) },
    '@tauri-apps/api/core': { invoke: async (...args) => { calls.push(args); } },
  };
  const callbacks = { onOpenAbout: action('about'), onOpenShortcuts: action('shortcuts'), onOpenReleaseNotes: action('release-notes') };
  const { executeMenuAction } = loadWithMocks(new URL('../frontend/core/services/applicationMenuActions.ts', import.meta.url), dependencies);
  return { git, prefs, perf, calls, execute: (id) => executeMenuAction(id, callbacks) };
}

test('shared dispatcher rechecks repo/file/sync/rebase gates and routes native-only gaps', async () => {
  const f = fixture();
  await f.execute('fetch');
  assert.deepEqual(f.calls.pop(), ['sync', 'fetch']);
  f.git.isSyncing = true;
  await f.execute('fetch');
  assert.equal(f.calls.length, 0);
  f.git.isSyncing = false;
  await f.execute('rebase_continue');
  assert.equal(f.calls.length, 0);
  f.git.isRebasing = true;
  await f.execute('rebase_continue');
  assert.deepEqual(f.calls.pop(), ['sync', 'rebase_continue']);
  await f.execute('view_blame');
  assert.equal(f.calls.length, 0);
  f.git.selectedFile = { path: 'binary', is_binary: true };
  await f.execute('view_blame');
  assert.equal(f.calls.length, 0);
  f.git.selectedFile = { path: 'file.ts', is_binary: false };
  await f.execute('view_blame');
  assert.deepEqual(f.calls.splice(0), [['file-tab', 'blame'], ['blame', 'file.ts']]);
  await f.execute('repo_overview'); await f.execute('release_notes');
  assert.deepEqual(f.calls.splice(0), [['overview', true], ['release-notes']]);
  f.git.currentRepo = null;
  await f.execute('repo_overview'); await f.execute('unknown');
  assert.equal(f.calls.length, 0);
});

test('recent repository IDs route to the exact current item and ignore removed entries', async () => {
  const f = fixture();
  f.git.recentRepos = [{ id: 'one', name: 'One' }, { id: 'two', name: 'Two' }];
  await f.execute('recent_repo_two');
  assert.deepEqual(f.calls.pop(), ['selectRepo', f.git.recentRepos[1]]);
  await f.execute('remove_recent_repo_one');
  assert.deepEqual(f.calls.pop(), ['removeRecentRepo', 'one']);
  f.git.recentRepos = [];
  await f.execute('recent_repo_two');
  assert.equal(f.calls.length, 0);
});

test('shortcut matching is exact, preserves editing shortcuts and avoids Ctrl+W tab conflicts', () => {
  const event = (overrides) => ({ key: 'p', code: 'KeyP', ctrlKey: true, metaKey: false, shiftKey: true, altKey: false, ...overrides });
  assert.equal(shortcuts.menuActionForShortcut(event({}), false), 'pull');
  assert.equal(shortcuts.menuActionForShortcut(event({ altKey: true, shiftKey: false }), false), 'pull_from');
  assert.equal(shortcuts.menuActionForShortcut(event({ altKey: true }), false), undefined);
  assert.equal(shortcuts.menuActionForShortcut(event({ key: 'w', code: 'KeyW', shiftKey: false }), false), undefined);
  assert.equal(shortcuts.menuActionForShortcut(event({ key: 'w', code: 'KeyW' }), false), 'close_window');
  assert.equal(shortcuts.menuActionForShortcut(event({ key: 'c', code: 'KeyC', shiftKey: false }), false), undefined);
  assert.equal(shortcuts.menuActionForShortcut(event({ ctrlKey: false, metaKey: true }), true), 'pull');
  assert.equal(shortcuts.menuActionForShortcut(event({}), true), undefined);
});

test('custom renderer uses common enable/check state, rounding and preserves focus on click', async () => {
  const runner = componentHarness();
  const { ConfiguredMenu } = loadWithMocks(new URL('../frontend/core/components/layout/menu-bar/ConfiguredMenu.tsx', import.meta.url), {
    react: runner.react, './menuIcons': { menuIcons: { Columns2: () => null } },
    '../../../../common/components/icons/Check': { Check: () => null },
    '../../../../common/components/icons/ChevronRight': { ChevronRight: () => null },
  });
  const actions = [];
  let props = { node: { command: 'view_split' }, flags: { repository: true, split: true },
    platform: 'windows', fileManager: 'File Explorer', recentRepos: [],
    execute: (id) => actions.push(id), onClose: () => actions.push('close') };
  let tree = await runner.render(ConfiguredMenu, props);
  let item = componentNodes(tree).find((node) => node.type === 'button');
  assert.equal(item.props.role, 'menuitemcheckbox');
  assert.equal(item.props['aria-checked'], true);
  assert.match(item.props.className, /rounded-sm/);
  assert.equal(item.props.disabled, false);
  let prevented = false;
  item.props.onMouseDown({ preventDefault() { prevented = true; } });
  item.props.onClick();
  assert.equal(prevented, true);
  assert.deepEqual(actions, ['close', 'view_split']);
  props.flags.repository = false;
  tree = await runner.render(ConfiguredMenu, props);
  item = componentNodes(tree).find((node) => node.type === 'button');
  assert.equal(item.props.disabled, true);
});

test('native hook syncs flags, executes each event once and disposes late listeners', async (t) => {
  const runner = hookHarness();
  const previousWindow = globalThis.window;
  const handlers = new Map(), calls = [];
  globalThis.window = { addEventListener: (name, fn) => handlers.set(name, fn), removeEventListener: (name) => handlers.delete(name) };
  t.after(() => { runner.cleanup(); globalThis.window = previousWindow; });
  let native = true, listener, resolveListener, stopped = 0;
  const { useApplicationMenu } = loadWithMocks(new URL('../frontend/core/components/layout/useApplicationMenu.ts', import.meta.url), {
    react: runner.react,
    '@tauri-apps/api/core': { isTauri: () => native, invoke: async (...args) => calls.push(args) },
    '@tauri-apps/api/event': { listen: async (_, callback) => { listener = callback; return new Promise((resolve) => { resolveListener = resolve; }); } },
    '../../../common/utils/shortcuts': { isMacOS: () => true },
    '../../../features/git/store/useGitStore': { useGitStore: () => ({}) },
    '../../../features/preferences/store/usePreferencesStore': { usePreferencesStore: () => ({}) },
    '../../../features/performance/store/usePerformanceMonitorStore': { usePerformanceMonitorStore: () => ({}) },
    '../../../features/virtual-mr/store/useVirtualMrStore': { useVirtualMrStore: () => ({}) },
    '../../services/keymaps/context': {
      keymapsBlocked: () => false,
      keymapContext: () => ({ repository: true, editable: false, interactive: false, blocked: false, flags: { repository: true, idle: true } }),
    },
    '../../services/applicationMenuState': { getApplicationMenuFlags: () => ({ repository: true }) },
    '../../services/applicationMenuActions': { executeMenuAction: async (id, callbacks) => { calls.push(id); callbacks.onOpenAbout(); } },
  });
  const callbacks = { onOpenAbout: () => calls.push('about-callback') };
  runner.render(useApplicationMenu, callbacks);
  assert.equal(calls[0][0], 'update_application_menu_state');
  const event = { key: 'o', code: 'KeyO', metaKey: true, ctrlKey: false, shiftKey: false, altKey: false, preventDefault() { throw Error('native shortcut must not dispatch from DOM'); } };
  handlers.get('keydown')(event);
  listener({ payload: 'about' });
  assert.deepEqual(calls.slice(1), ['about', 'about-callback']);
  runner.cleanup();
  listener({ payload: 'about' });
  resolveListener(() => { stopped++; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(stopped, 1);
  assert.equal(calls.filter((call) => call === 'about').length, 1);
  assert.equal(calls.filter((call) => call === 'about-callback').length, 1);
  assert.equal(
    calls.filter((call) => Array.isArray(call) && call[0] === 'update_recent_repositories_menu').length,
    1,
    'the initial menu sync must also publish the empty recent-repository list once'
  );
  native = false;
});

test('controlled submenus open from the keyboard and notify the parent when leaving', async (t) => {
  const runner = componentHarness();
  const previous = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => 0;
  t.after(() => { globalThis.requestAnimationFrame = previous; });
  const events = [];
  const { ConfiguredMenu } = loadWithMocks(new URL('../frontend/core/components/layout/menu-bar/ConfiguredMenu.tsx', import.meta.url), {
    react: runner.react, './menuIcons': { menuIcons: {} },
    '../../../../common/components/icons/Check': { Check: () => null },
    '../../../../common/components/icons/ChevronRight': { ChevronRight: () => null },
  });
  const props = { node: { id: 'submenu', label: 'Submenu', items: [] }, flags: {},
    isOpen: false, platform: 'windows', fileManager: 'File Explorer', recentRepos: [],
    onHover: () => events.push('open'), onLeave: () => events.push('leave'), execute() {}, onClose() {} };
  let tree = await runner.render(ConfiguredMenu, props);
  let button = componentNodes(tree).find((node) => node.type === 'button');
  button.props.onKeyDown({ key: 'ArrowRight', currentTarget: {}, preventDefault() {} });
  assert.deepEqual(events, ['open']);
  tree.props.onMouseLeave();
  assert.deepEqual(events, ['open', 'leave']);
  props.isOpen = true;
  tree = await runner.render(ConfiguredMenu, props);
  button = componentNodes(tree).find((node) => node.type === 'button');
  button.props.onClick();
  assert.equal(events.at(-1), 'leave');
});

test('every configured icon resolves to its explicit imported component, including Info and official VsCode', () => {
  const names = new Set(Object.values(config.commands).map((command) => command.icon).filter(Boolean));
  names.add('Clock');
  const components = Object.fromEntries([...names].map((name) => [name, () => null]));
  const dependencies = Object.fromEntries([...names].map((name) => [
    `../../../../common/components/icons/${name}`, { [name]: components[name] },
  ]));
  const { menuIcons } = loadWithMocks(new URL('../frontend/core/components/layout/menu-bar/menuIcons.ts', import.meta.url), dependencies);
  for (const name of names) assert.equal(menuIcons[name], components[name], name);
});

test('a delayed clipboard paste never writes into a newly focused field', async (t) => {
  const previousDocument = globalThis.document;
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let resolve;
  const clipboard = new Promise((done) => { resolve = done; });
  const calls = [];
  globalThis.document = { activeElement: {}, execCommand: (...args) => { calls.push(args); return false; } };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { readText: () => clipboard } } });
  t.after(() => {
    globalThis.document = previousDocument;
    if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
    else delete globalThis.navigator;
  });
  const { runMenuTextEditing } = loadWithMocks(new URL('../frontend/core/services/applicationMenuTextEditing.ts', import.meta.url), {});
  const pending = runMenuTextEditing('paste');
  globalThis.document.activeElement = {};
  resolve('clipboard text');
  await pending;
  assert.deepEqual(calls, [['paste']]);
  await runMenuTextEditing('copy');
  assert.deepEqual(calls.at(-1), ['copy']);
});
