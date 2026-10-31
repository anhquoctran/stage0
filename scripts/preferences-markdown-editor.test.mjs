import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';
import { markdownPreferencesHarness } from './helpers/markdownPreferencesHarness.mjs';

test('Markdown editor font participates in Apply and publishes only after persistence succeeds', async (t) => {
  const fixture = markdownPreferencesHarness(); t.after(fixture.cleanup);
  let state = fixture.render();
  state.appearance.setDraftMarkdownEditorFontFamily('Consolas');
  state = fixture.render();
  assert.equal(state.transaction.totalUnsaved, 1);
  assert.equal(state.transaction.canCommitPreferences, true);
  let release;
  fixture.pause(new Promise((resolve) => { release = resolve; }));
  const pending = state.transaction.handleApply();
  assert.deepEqual(fixture.patches, [{ appearance: { markdownFont: { ...fixture.markdownFont, editorFontFamily: 'Consolas' } } }]);
  assert.equal(fixture.preferences.markdownEditorFontFamily, 'Fira Code');
  release();
  assert.equal(await pending, true);
  assert.equal(fixture.preferences.markdownEditorFontFamily, 'Consolas');
  state = fixture.render();
  assert.equal(state.transaction.totalUnsaved, 0);
  assert.equal(state.transaction.savedBaseline.markdownEditorFontFamily, 'Consolas');
  assert.equal(fixture.previews.at(-1).editorFontFamily, 'Consolas');
});

test('failed Apply retains the Markdown editor draft and the committed font', async (t) => {
  const fixture = markdownPreferencesHarness(); t.after(fixture.cleanup);
  let state = fixture.render();
  state.appearance.setDraftMarkdownEditorFontFamily('Consolas');
  state = fixture.render(); fixture.fail();
  assert.equal(await state.transaction.handleApply(), false);
  state = fixture.render();
  assert.equal(fixture.preferences.markdownEditorFontFamily, 'Fira Code');
  assert.equal(state.appearance.draftMarkdownEditorFontFamily, 'Consolas');
  assert.equal(state.transaction.totalUnsaved, 1);
  assert.match(state.transaction.applyError, /Disk unavailable/);
});

test('Cancel restores the last applied font; reopening discards the editor font draft', async (t) => {
  const fixture = markdownPreferencesHarness(); t.after(fixture.cleanup);
  let state = fixture.render();
  state.appearance.setDraftMarkdownEditorFontFamily('Consolas');
  state = fixture.render(); await state.transaction.handleApply();
  state = fixture.render(); state.appearance.setDraftMarkdownEditorFontFamily('Arial');
  state = fixture.render(); state.transaction.handleCancel();
  assert.equal(fixture.preferences.isPreferencesOpen, false);
  assert.equal(fixture.previews.at(-1).editorFontFamily, 'Consolas');
  fixture.render(); fixture.preferences.isPreferencesOpen = true;
  fixture.render(); state = fixture.render();
  assert.equal(state.appearance.draftMarkdownEditorFontFamily, 'Consolas');
  assert.equal(state.transaction.totalUnsaved, 0);
});

test('OK persists editor fonts and reset remains a draft until applied', async (t) => {
  const fixture = markdownPreferencesHarness(); t.after(fixture.cleanup);
  let state = fixture.render(); state.appearance.setDraftMarkdownEditorFontFamily('Arial');
  state = fixture.render(); await state.transaction.handleOk();
  assert.equal(fixture.preferences.isPreferencesOpen, false);
  assert.equal(fixture.preferences.markdownEditorFontFamily, 'Arial');
  fixture.render(); fixture.preferences.isPreferencesOpen = true;
  fixture.render(); state = fixture.render(); state.transaction.handleResetDefaults();
  state = fixture.render();
  assert.equal(state.appearance.draftMarkdownEditorFontFamily, 'Fira Code');
  assert.equal(fixture.preferences.markdownEditorFontFamily, 'Arial');
  assert.equal(fixture.previews.at(-1).editorFontFamily, 'Fira Code');
});

test('all Markdown typography changes enable Apply, not just the new editor font', (t) => {
  const fixture = markdownPreferencesHarness(); t.after(fixture.cleanup);
  const state = fixture.render();
  state.appearance.setDraftMarkdownFontFamily('Inter');
  state.appearance.setDraftMarkdownCodeFontFamily('Hack');
  state.appearance.setDraftMarkdownFontSize(16);
  state.appearance.setDraftMarkdownHeadingWeight(700);
  assert.equal(fixture.render().transaction.totalUnsaved, 4);
});

for (const source of ['preferences.json', 'legacy storage']) {
  test(`older ${source} font settings load with an editor font default and retain existing preview fonts`, (t) => {
    const previous = { window: globalThis.window, document: globalThis.document, localStorage: globalThis.localStorage };
    t.after(() => {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
      }
    });
    const old = { fontFamily: 'Georgia', codeFontFamily: 'Hack', fontSize: 16, headingFontWeight: 700 };
    const listeners = {}, css = new Map(), patches = [];
    globalThis.window = { __STAGE0_PREFERENCES__: source === 'preferences.json' ? { appearance: { markdownFont: old } } : {},
      addEventListener: (name, callback) => { listeners[name] = callback; } };
    globalThis.document = { documentElement: { style: {
      setProperty: (key, value) => css.set(key, value), removeProperty: (key) => css.delete(key),
    } } };
    globalThis.localStorage = {
      getItem: (key) => source === 'legacy storage' && key === 'stage0_markdown_font_settings' ? JSON.stringify(old) : null,
      setItem() {},
    };
    const { usePreferencesStore } = loadWithMocks(
      new URL('../frontend/features/preferences/store/usePreferencesStore.ts', import.meta.url),
      { '../services/preferencesJsonService': { preferencesJsonService: { patch: async (patch) => { patches.push(patch); } } } },
    );
    assert.equal(usePreferencesStore.getState().markdownEditorFontFamily, 'Fira Code');
    assert.equal(usePreferencesStore.getState().markdownFontFamily, 'Georgia');
    usePreferencesStore.getState().updateMarkdownFontSettings({ editorFontFamily: 'Arial' });
    assert.deepEqual(patches[0], { appearance: { markdownFont: { ...old, editorFontFamily: 'Arial' } } });
    assert.match(css.get('--markdown-editor-font-family'), /Arial/);
    const saved = { appearance: { markdownFont: { ...old, editorFontFamily: 'Consolas' } } };
    listeners['stage0-preferences-updated']({ detail: saved });
    assert.equal(usePreferencesStore.getState().markdownEditorFontFamily, 'Consolas');
    assert.equal(usePreferencesStore.getState().markdownCodeFontFamily, 'Hack');
    assert.match(css.get('--markdown-editor-font-family'), /Consolas/);
    globalThis.window.__STAGE0_PREFERENCES__ = saved;
    const reloaded = loadWithMocks(
      new URL('../frontend/features/preferences/store/usePreferencesStore.ts', import.meta.url), {},
    );
    assert.equal(reloaded.usePreferencesStore.getState().markdownEditorFontFamily, 'Consolas');
    usePreferencesStore.getState().resetMarkdownFontSettings();
    assert.equal(usePreferencesStore.getState().markdownEditorFontFamily, 'Fira Code');
  });
}

test('Markdown font tab exposes a shared select, reset and editor preview without changing preview fonts', async (t) => {
  const runner = componentHarness(); const previews = [];
  t.after(() => runner.cleanup());
  const { PreferencesMarkdownFontTab } = loadWithMocks(
    new URL('../frontend/features/preferences/components/tabs/PreferencesMarkdownFontTab.tsx', import.meta.url),
    { react: runner.react,
      '../../../../common/components/icons/Undo2': { Undo2: () => null },
      '../../../../common/components/CustomSelect': { CustomSelect: () => null },
      '../../utils/applyMarkdownFontToDocument': { applyMarkdownFontToDocument: (settings) => previews.push(settings) } },
  );
  const props = { draftMarkdownFontFamily: 'Arial', draftMarkdownCodeFontFamily: 'Fira Code',
    draftMarkdownEditorFontFamily: 'Consolas', draftMarkdownFontSize: 14, draftMarkdownHeadingWeight: 600,
    setDraftMarkdownEditorFontFamily: (value) => { props.draftMarkdownEditorFontFamily = value; },
    setDraftMarkdownFontFamily() {}, setDraftMarkdownCodeFontFamily() {},
    setDraftMarkdownFontSize() {}, setDraftMarkdownHeadingWeight() {} };
  let tree = await runner.render(PreferencesMarkdownFontTab, props);
  let nodes = componentNodes(tree);
  const select = nodes.find((node) => node.props['aria-label'] === 'Markdown Editor Font');
  assert.ok(select.props.searchable);
  assert.ok(select.props.options.some((option) => option.value === 'Arial'));
  select.props.onChange('Arial');
  tree = await runner.render(PreferencesMarkdownFontTab, props); nodes = componentNodes(tree);
  assert.equal(previews.at(-1).editorFontFamily, 'Arial');
  assert.equal(previews.at(-1).fontFamily, 'Arial');
  assert.equal(previews.at(-1).codeFontFamily, 'Fira Code');
  assert.ok(nodes.some((node) => node.type === 'textarea' && node.props.readOnly && node.props.className.includes('markdown-editor-textarea')));
  nodes.find((node) => node.props.title === 'Reset Markdown Editor Font to default (Fira Code)').props.onClick();
  assert.equal(props.draftMarkdownEditorFontFamily, 'Fira Code');
  const css = readFileSync(new URL('../frontend/core/styles/index.css', import.meta.url), 'utf8');
  assert.match(css, /\.markdown-editor-textarea\s*\{\s*font-family:\s*var\(--markdown-editor-font-family, var\(--viewer-font-family, monospace\)\)/);
});
