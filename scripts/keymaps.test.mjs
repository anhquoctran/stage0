import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWithMocks } from './helpers/componentHarness.mjs';

const source = (name) => new URL(`../frontend/core/services/keymaps/${name}.ts`, import.meta.url);
const catalog = loadWithMocks(source('catalog'), {});
const { keymapErrors, readKeymap } = loadWithMocks(source('validation'), {});
const { eventStroke, normalizeShortcut, formatKeybinding } = loadWithMocks(source('keystroke'), {});
const { createKeymapEngine } = loadWithMocks(source('engine'), {});
const { nativeKeymapAccelerators } = loadWithMocks(source('native'), {});
const settings = (overrides = [], preset = 'stage0') => ({ preset, overrides });
const event = (key, extra = {}) => ({ key, code: /^[a-z]$/i.test(key) ? `Key${key.toUpperCase()}` : key,
  ctrlKey: false, metaKey: false, altKey: false, shiftKey: false,
  defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, ...extra });
const context = (extra = {}) => ({ repository: true, editable: false, interactive: false, blocked: false,
  flags: { repository: true, file: true, textFile: true, idle: true, rebasing: true }, ...extra });

test('all presets resolve without conflicts on macOS, Windows and Linux', () => {
  for (const preset of catalog.KEYMAP_PRESETS) for (const platform of ['macos', 'windows', 'linux']) {
    assert.deepEqual(keymapErrors(settings([], preset.id), platform), [], `${preset.id}/${platform}`);
    assert.ok(catalog.resolveKeymap(settings([], preset.id), platform).some((item) => item.id === 'close_tab'));
  }
});

test('preset inheritance, multiple overrides and explicit unbinding preserve unrelated commands', () => {
  const custom = settings([{ command: 'pull', keys: [] }, { command: 'fetch', keys: ['Ctrl+F8', 'CmdOrCtrl+F9'] }], 'vscode');
  const commands = catalog.resolveKeymap(custom, 'macos');
  assert.deepEqual(commands.find((item) => item.id === 'pull').keys, []);
  assert.deepEqual(commands.find((item) => item.id === 'fetch').keys, ['Ctrl+F8', 'CmdOrCtrl+F9']);
  assert.deepEqual(commands.find((item) => item.id === 'keymaps').keys, ['CmdOrCtrl+K CmdOrCtrl+S']);
  assert.deepEqual(keymapErrors(custom, 'macos'), []);
  assert.deepEqual(catalog.DEFAULT_KEYMAP, settings());
});

test('validation rejects equal/prefix conflicts, protected editing, malformed keys and records', () => {
  for (const override of [
    { command: 'fetch', keys: ['CmdOrCtrl+Shift+P'] },
    { command: 'fetch', keys: ['CmdOrCtrl+K'] },
    { command: 'fetch', keys: ['CmdOrCtrl+C'] },
    { command: 'copy', keys: [] }, { command: 'unknown', keys: [] },
    { command: 'fetch', keys: ['Tab'] }, { command: 'fetch', keys: ['Shift+Escape'] },
    { command: 'fetch', keys: ['CmdOrCtrl+K Escape'] }, { command: 'fetch', keys: ['CmdOrCtrl+K Tab'] },
    { command: 'fetch', keys: ['Ctrl+Ctrl+A'] }, { command: 'fetch', keys: ['Ctrl+'] },
    { command: 'fetch', keys: ['Ctrl+A Ctrl+B Ctrl+C'] }, { command: 'fetch', keys: [3] },
    { command: 'fetch', keys: [], unknown: true },
  ]) assert.ok(keymapErrors(settings([override], 'vscode'), 'macos').length, JSON.stringify(override));
  assert.ok(keymapErrors(settings([{ command: 'fetch', keys: [] }, { command: 'fetch', keys: [] }]), 'linux').length);
  assert.ok(keymapErrors(settings([], 'unknown'), 'linux').length);
  assert.deepEqual(readKeymap({ preset: 'unknown', overrides: [] }), settings());
});

test('normalization preserves actual Control vs Command, shifted keys and portable recording', () => {
  assert.equal(normalizeShortcut('mod+shift+k control+s', true), 'Cmd+Shift+K Ctrl+S');
  assert.equal(normalizeShortcut('mod+shift+k control+s', false), 'Ctrl+Shift+K Ctrl+S');
  assert.equal(formatKeybinding('Ctrl+Backquote', true), '⌃+Backquote');
  assert.equal(formatKeybinding('CmdOrCtrl+K CmdOrCtrl+S', true), '⌘+K ⌘+S');
  assert.equal(eventStroke(event('!', { code: 'Digit1', ctrlKey: true, shiftKey: true }), false), 'Ctrl+Shift+1');
  assert.equal(eventStroke(event('?', { code: 'Slash', metaKey: true, shiftKey: true }), true), 'Cmd+Shift+/');
  assert.equal(eventStroke(event('π', { code: 'KeyP', altKey: true, metaKey: true }), true), 'Cmd+Alt+P');
  assert.equal(eventStroke(event('k', { metaKey: true }), true, true), 'CmdOrCtrl+K');
  assert.equal(eventStroke(event('k', { metaKey: true, ctrlKey: true }), true, true), 'Ctrl+Cmd+K');
});

test('runtime respects exact modifiers, IME, repeat, editing focus and modal scopes', () => {
  const calls = []; let current = context();
  const engine = createKeymapEngine({ mac: false, getCommands: () => catalog.resolveKeymap(settings(), 'linux'), getContext: () => current, execute: (id) => calls.push(id) });
  assert.equal(engine.handle(event('p', { ctrlKey: true, shiftKey: true })), true);
  assert.deepEqual(calls, ['pull']);
  for (const extra of [{ altKey: true }, { isComposing: true }, { repeat: true }, { keyCode: 229 }, { defaultPrevented: true }, { getModifierState: () => true }])
    assert.equal(engine.handle(event('p', { ctrlKey: true, shiftKey: true, ...extra })), false);
  current = context({ editable: true });
  assert.equal(engine.handle(event('p', { ctrlKey: true, shiftKey: true })), false);
  assert.equal(engine.handle(event('j')), false);
  current = context({ interactive: true });
  assert.equal(engine.handle(event('ArrowDown')), false);
  current = context({ blocked: true });
  assert.equal(engine.handle(event(',', { ctrlKey: true })), false);
  assert.deepEqual(calls, ['pull']);
  engine.dispose();
});

test('repository and welcome shortcuts can share keys without executing twice', () => {
  const calls = []; let current = context();
  const engine = createKeymapEngine({ mac: false, getCommands: () => catalog.resolveKeymap(settings(), 'linux'), getContext: () => current, execute: (id) => calls.push(id) });
  engine.handle(event('1', { ctrlKey: true }));
  current = context({ repository: false, flags: {} });
  engine.handle(event('1', { ctrlKey: true }));
  assert.deepEqual(calls, ['view_split', 'recent_1']);
  engine.dispose();
});

test('chords complete once, cancel on Escape, timeout and recheck context at the second step', async () => {
  const calls = [], hints = []; let current = context();
  const engine = createKeymapEngine({ mac: false, timeoutMs: 15,
    getCommands: () => catalog.resolveKeymap(settings([], 'vscode'), 'linux'),
    getContext: () => current, execute: (id) => calls.push(id), onChord: (key) => hints.push(key) });
  const first = () => engine.handle(event('k', { ctrlKey: true }));
  const second = () => engine.handle(event('s', { ctrlKey: true }));
  assert.equal(first(), true); assert.equal(second(), true);
  assert.deepEqual(calls, ['keymaps']);
  first(); engine.handle(event('k', { ctrlKey: true, repeat: true })); second();
  assert.deepEqual(calls, ['keymaps', 'keymaps']);
  first(); engine.handle(event('Escape')); assert.equal(second(), false);
  first(); await new Promise((resolve) => setTimeout(resolve, 25)); assert.equal(second(), false);
  first(); current = context({ editable: true }); assert.equal(second(), false);
  assert.deepEqual(calls, ['keymaps', 'keymaps']);
  assert.equal(hints.at(-1), null);
  engine.dispose();
});

test('file navigation retains held-key repeat without repeating Git operations', () => {
  const calls = [];
  const engine = createKeymapEngine({ mac: false, getCommands: () => catalog.resolveKeymap(settings(), 'linux'), getContext: () => context(), execute: (id) => calls.push(id) });
  engine.handle(event('j')); engine.handle(event('j', { repeat: true }));
  engine.handle(event('p', { ctrlKey: true, shiftKey: true, repeat: true }));
  assert.deepEqual(calls, ['next_file', 'next_file']);
  engine.dispose();
});

test('macOS native accelerators own only eligible single bindings and suspend during Preferences', () => {
  const commands = catalog.resolveKeymap(settings([], 'vscode'), 'macos');
  const native = nativeKeymapAccelerators(commands);
  assert.equal(native.open_repo, 'Cmd+O');
  assert.equal(native.pull, undefined, 'workspace commands need WebView focus/context guards');
  assert.equal(native.keymaps, undefined, 'chords cannot be registered as native accelerators');
  assert.deepEqual(nativeKeymapAccelerators(commands, true), {});
  const calls = [];
  const engine = createKeymapEngine({ mac: true, getCommands: () => commands, getContext: () => context(), execute: (id) => calls.push(id), nativeOwns: (id, key) => native[id] === key });
  assert.equal(engine.handle(event('o', { metaKey: true })), false);
  assert.equal(engine.handle(event('p', { metaKey: true, shiftKey: true })), true);
  assert.deepEqual(calls, ['pull']);
  engine.dispose();
});

test('shortcut help uses effective bindings, including unassignment and chords', () => {
  const { getMenuShortcutCategories } = loadWithMocks(new URL('../frontend/core/services/applicationMenuShortcuts.ts', import.meta.url), {});
  const help = getMenuShortcutCategories('linux', 'File Manager', settings([{ command: 'pull', keys: [] }], 'vscode'));
  assert.ok(!help.flatMap((item) => item.items).some((item) => item.label === 'Pull'));
  assert.ok(help.flatMap((item) => item.items).some((item) => item.label === 'Customize Keymap...' && item.keys === 'Ctrl+K Ctrl+S'));
});
