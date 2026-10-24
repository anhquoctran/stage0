import { usePreferencesStore, applyViewerFontToDocument } from '../../preferences/store/usePreferencesStore';
import { applyMarkdownFontToDocument } from '../../preferences/utils/applyMarkdownFontToDocument';
import { applyUiFontToDocument } from '../../preferences/utils/applyUiFontToDocument';
import { DEFAULT_UI_FONT_FAMILY } from '../../preferences/constants/uiFonts';
import { preferencesJsonService } from '../../preferences/services/preferencesJsonService';
import { keymapErrors } from '../../../core/services/keymaps/validation';
import type { OnboardingPreferences } from '../types/OnboardingPreferences';

export function captureOnboardingPreferences(): OnboardingPreferences {
  const state = usePreferencesStore.getState();
  return structuredClone({
    keymap: state.keymap,
    uiFontFamily: state.uiFontFamily ?? DEFAULT_UI_FONT_FAMILY,
    viewerFont: {
      fontFamily: state.fontFamily, fontSize: state.fontSize,
      isBold: state.isBold, isItalic: state.isItalic, isUnderline: state.isUnderline,
      lineSpacing: state.lineSpacing, enableLigatures: state.enableLigatures,
    },
    markdownFont: {
      fontFamily: state.markdownFontFamily, codeFontFamily: state.markdownCodeFontFamily,
      editorFontFamily: state.markdownEditorFontFamily, fontSize: state.markdownFontSize,
      headingFontWeight: state.markdownHeadingFontWeight,
    },
  });
}

export function previewOnboardingPreferences(settings: OnboardingPreferences): void {
  applyUiFontToDocument(settings.uiFontFamily);
  applyViewerFontToDocument(settings.viewerFont);
  applyMarkdownFontToDocument(settings.markdownFont);
}

function changedFields<T extends object>(before: T, after: T): Partial<T> {
  return Object.fromEntries(Object.entries(after).filter(([key, value]) =>
    JSON.stringify(before[key as keyof T]) !== JSON.stringify(value))) as Partial<T>;
}

function assertNoConflicts<T extends object>(before: T, draft: T, current: T): void {
  const changes = changedFields(before, draft);
  const external = changedFields(before, current);
  for (const key of Object.keys(changes) as Array<keyof T>) {
    if (key in external && JSON.stringify(external[key]) !== JSON.stringify(changes[key])) {
      throw new Error('These settings changed in another window. Reload saved settings before continuing.');
    }
  }
}

export async function saveOnboardingPreferences(draft: OnboardingPreferences, baseline: OnboardingPreferences): Promise<void> {
  const errors = ['macos', 'windows', 'linux'].flatMap((platform) => keymapErrors(draft.keymap, platform));
  if (errors.length) throw new Error([...new Set(errors)].join(' '));
  const current = captureOnboardingPreferences();
  // Detect edits made elsewhere before the save started; the JSON service handles
  // revision conflicts during the write. Never replace an entire appearance object.
  assertNoConflicts(
    { keymap: baseline.keymap, uiFontFamily: baseline.uiFontFamily },
    { keymap: draft.keymap, uiFontFamily: draft.uiFontFamily },
    { keymap: current.keymap, uiFontFamily: current.uiFontFamily }
  );
  assertNoConflicts(baseline.viewerFont, draft.viewerFont, current.viewerFont);
  assertNoConflicts(baseline.markdownFont, draft.markdownFont, current.markdownFont);
  const viewerChanges = changedFields(baseline.viewerFont, draft.viewerFont);
  const markdownChanges = changedFields(baseline.markdownFont, draft.markdownFont);
  const uiChanged = draft.uiFontFamily !== baseline.uiFontFamily;
  const keymapChanged = JSON.stringify(draft.keymap) !== JSON.stringify(baseline.keymap);
  const appearance: Record<string, unknown> = {};
  if (uiChanged) appearance.uiFont = { fontFamily: draft.uiFontFamily };
  if (Object.keys(viewerChanges).length) appearance.viewerFont = viewerChanges;
  if (Object.keys(markdownChanges).length) appearance.markdownFont = markdownChanges;
  const patch: Record<string, unknown> = {};
  if (keymapChanged) patch.keymap = draft.keymap;
  if (Object.keys(appearance).length) patch.appearance = appearance;
  if (!Object.keys(patch).length) return;
  await preferencesJsonService.patch(patch);

  // Native saves broadcast their committed settings; the web fallback does not.
  // Merge the same delta into the latest store in either case, after success only.
  const committed = captureOnboardingPreferences();
  const markdown = { ...committed.markdownFont, ...markdownChanges };
  usePreferencesStore.setState({
    ...(keymapChanged ? { keymap: structuredClone(draft.keymap) } : {}),
    ...(uiChanged ? { uiFontFamily: draft.uiFontFamily } : {}),
    ...viewerChanges,
    markdownFontFamily: markdown.fontFamily, markdownCodeFontFamily: markdown.codeFontFamily,
    markdownEditorFontFamily: markdown.editorFontFamily, markdownFontSize: markdown.fontSize,
    markdownHeadingFontWeight: markdown.headingFontWeight,
  });
  previewOnboardingPreferences(captureOnboardingPreferences());
}
