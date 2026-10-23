import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';

const url = (path) => new URL(`../frontend/${path}`, import.meta.url);
const { KEYMAP_PRESETS, resolveKeymap } = loadWithMocks(url('core/services/keymaps/catalog.ts'), {});
const { keymapErrors, readKeymap } = loadWithMocks(url('core/services/keymaps/validation.ts'), {});
const settings = (preset, overrides = []) => ({ preset, overrides });
const keys = (preset, platform) => Object.fromEntries(resolveKeymap(settings(preset), platform).map((command) => [command.id, command.keys]));

test('Git GUI presets are registered once and accepted by persisted settings', () => {
  for (const [id, label] of [['fork', 'Fork'], ['sourcetree', 'SourceTree'], ['gitkraken', 'GitKraken']]) {
    const matches = KEYMAP_PRESETS.filter((item) => item.id === id);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].label, label);
    assert.match(matches[0].documentation, /^https:\/\//);
    assert.deepEqual(readKeymap(settings(id)), settings(id));
  }
});

for (const platform of ['macos', 'windows', 'linux']) {
  test(`Fork keeps its clone/refresh/tool differences and avoids collisions on ${platform}`, () => {
    const resolved = keys('fork', platform);
    assert.deepEqual(keymapErrors(settings('fork'), platform), []);
    assert.deepEqual(resolved.fetch, ['CmdOrCtrl+Shift+F']);
    assert.deepEqual(resolved.pull, ['CmdOrCtrl+Shift+L']);
    assert.deepEqual(resolved.preferences, ['CmdOrCtrl+,']);
    assert.deepEqual(resolved.new_window, []);
    assert.deepEqual(resolved.clone_repo, [platform === 'macos' ? 'Cmd+Shift+N' : 'CmdOrCtrl+N']);
    assert.deepEqual(resolved.refresh_diff, [platform === 'macos' ? 'Cmd+R' : 'F5']);
    assert.deepEqual(resolved.open_terminal, [platform === 'macos' ? 'Ctrl+Cmd+T' : 'Ctrl+Alt+T']);
    assert.deepEqual(resolved.open_explorer, [platform === 'macos' ? 'Ctrl+Cmd+O' : 'Ctrl+Alt+O']);
  });
  test(`SourceTree adapts documented operations and preserves unmatched defaults on ${platform}`, () => {
    const resolved = keys('sourcetree', platform);
    assert.deepEqual(keymapErrors(settings('sourcetree'), platform), []);
    assert.deepEqual(resolved.pull, ['CmdOrCtrl+Shift+L']);
    assert.deepEqual(resolved.refresh_diff, platform === 'macos' ? ['Cmd+R'] : ['F5', 'CmdOrCtrl+R']);
    assert.deepEqual(resolved.open_terminal, [platform === 'macos' ? 'Ctrl+Cmd+T' : 'Alt+Shift+T']);
    assert.deepEqual(resolved.clone_repo, keys('stage0', platform).clone_repo);
  });
  test(`GitKraken numbered tabs and open-repo binding have no conflicting actions on ${platform}`, () => {
    const resolved = keys('gitkraken', platform);
    assert.deepEqual(keymapErrors(settings('gitkraken'), platform), []);
    assert.deepEqual(resolved.fetch, ['CmdOrCtrl+L']);
    assert.deepEqual(resolved.open_terminal, ['Alt+T']);
    assert.deepEqual(resolved.open_explorer, ['Alt+O']);
    assert.deepEqual(resolved.open_repo, ['CmdOrCtrl+Shift+O']);
    assert.deepEqual(resolved.view_blame, ['CmdOrCtrl+Shift+H']);
    for (let index = 1; index <= 9; index++) assert.deepEqual(resolved[`tab_${index}`], [`CmdOrCtrl+${index}`]);
    for (const id of ['view_split', 'view_unified', 'clone_repo', 'pull', 'merge']) assert.deepEqual(resolved[id], []);
    assert.deepEqual(resolved.copy, keys('stage0', platform).copy);
  });
}

test('custom overrides and reset-to-preset work for all three Git GUI presets', () => {
  for (const preset of ['fork', 'sourcetree', 'gitkraken']) {
    const custom = settings(preset, [{ command: 'fetch', keys: ['CmdOrCtrl+F8'] }]);
    assert.deepEqual(readKeymap(custom), custom);
    for (const platform of ['macos', 'windows', 'linux']) {
      assert.deepEqual(resolveKeymap(custom, platform).find((command) => command.id === 'fetch').keys, ['CmdOrCtrl+F8']);
      assert.notDeepEqual(keys(preset, platform).fetch, ['CmdOrCtrl+F8']);
    }
  }
});

test('Git GUI presets do not repurpose Push or the legacy Preferences alias', () => {
  for (const preset of ['fork', 'sourcetree', 'gitkraken']) for (const platform of ['macos', 'windows', 'linux']) {
    const resolved = resolveKeymap(settings(preset), platform);
    assert.ok(!resolved.some((command) => command.editable && command.keys.includes('CmdOrCtrl+Shift+P')));
    assert.deepEqual(resolved.find((command) => command.id === 'preferences').keys, ['CmdOrCtrl+,']);
  }
});

test('Preferences preset picker, search and JSONC completion expose the new presets', async () => {
  const runner = componentHarness();
  const { PreferencesKeymapTab } = loadWithMocks(url('features/preferences/components/tabs/PreferencesKeymapTab.tsx'), {
    react: runner.react, '../../../../common/components/CustomSelect': { CustomSelect: () => null },
    '../keymaps/KeymapBindingRow': { KeymapBindingRow: () => null },
  });
  let draft = settings('stage0', [{ command: 'fetch', keys: ['CmdOrCtrl+F8'] }]);
  const tree = await runner.render(PreferencesKeymapTab, { value: draft, onChange: (value) => { draft = value; } });
  const picker = componentNodes(tree).find((node) => node.props.id === 'keymap-preset');
  for (const preset of ['fork', 'sourcetree', 'gitkraken']) assert.ok(picker.props.options.some((option) => option.value === preset));
  picker.props.onChange('fork');
  assert.equal(draft.preset, 'fork');
  assert.deepEqual(draft.overrides, [{ command: 'fetch', keys: ['CmdOrCtrl+F8'] }]);
  const { SETTINGS_TREE } = loadWithMocks(url('features/preferences/constants/settingsTree.ts'), {});
  const entry = SETTINGS_TREE.flatMap((group) => group.children).find((item) => item.id === 'general-keymaps');
  for (const keyword of ['fork', 'sourcetree', 'gitkraken']) assert.ok(entry.keywords.includes(keyword));
  const { getPreferencesJsonCompletions } = loadWithMocks(url('features/preferences/utils/preferencesJsonCompletions.ts'), {});
  const source = '{"keymap":{"preset":"';
  const completion = getPreferencesJsonCompletions(source, source.length, true);
  for (const preset of ['fork', 'sourcetree', 'gitkraken']) assert.ok(completion.items.some((item) => item.label === preset));
  runner.cleanup();
});
