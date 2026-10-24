import { KeymapPresetPicker } from '../../preferences/components/keymaps/KeymapPresetPicker';
import { PreferencesUiFontTab } from '../../preferences/components/tabs/PreferencesUiFontTab';
import { PreferencesFontTab } from '../../preferences/components/tabs/PreferencesFontTab';
import { PreferencesMarkdownFontTab } from '../../preferences/components/tabs/PreferencesMarkdownFontTab';
import type { WelcomeSettingsProps } from '../types/WelcomeSettingsProps';
import type { ViewerFontSettings } from '../../preferences/types/ViewerFontSettings';
import type { MarkdownFontSettings } from '../../preferences/types/MarkdownFontSettings';
import type { SetStateAction } from 'react';

export function WelcomeSettingsPanel({ step, settings, onChange }: WelcomeSettingsProps) {
  const setViewer = <K extends keyof ViewerFontSettings>(key: K, value: SetStateAction<ViewerFontSettings[K]>) =>
    onChange((previous) => ({ ...previous, viewerFont: { ...previous.viewerFont,
      [key]: typeof value === 'function' ? value(previous.viewerFont[key]) : value } }));
  const setMarkdown = <K extends keyof MarkdownFontSettings>(key: K, value: SetStateAction<MarkdownFontSettings[K]>) =>
    onChange((previous) => ({ ...previous, markdownFont: { ...previous.markdownFont,
      [key]: typeof value === 'function' ? value(previous.markdownFont[key]) : value } }));

  if (step === 'keymaps') return <KeymapPresetPicker value={settings.keymap}
    onChange={(keymap) => onChange((previous) => ({ ...previous, keymap }))} />;
  if (step === 'ui-font') return <PreferencesUiFontTab value={settings.uiFontFamily}
    onChange={(uiFontFamily) => onChange((previous) => ({ ...previous, uiFontFamily }))} />;
  if (step === 'buffer-font') return <PreferencesFontTab
    draftFontFamily={settings.viewerFont.fontFamily} setDraftFontFamily={(value) => setViewer('fontFamily', value)}
    draftFontSize={settings.viewerFont.fontSize} setDraftFontSize={(value) => setViewer('fontSize', value)}
    draftIsBold={settings.viewerFont.isBold} setDraftIsBold={(value) => setViewer('isBold', value)}
    draftIsItalic={settings.viewerFont.isItalic} setDraftIsItalic={(value) => setViewer('isItalic', value)}
    draftIsUnderline={settings.viewerFont.isUnderline} setDraftIsUnderline={(value) => setViewer('isUnderline', value)}
    draftLineSpacing={settings.viewerFont.lineSpacing} setDraftLineSpacing={(value) => setViewer('lineSpacing', value)}
    draftEnableLigatures={settings.viewerFont.enableLigatures} setDraftEnableLigatures={(value) => setViewer('enableLigatures', value)} />;
  if (step === 'markdown-font') return <PreferencesMarkdownFontTab
    showPreview={false}
    draftMarkdownFontFamily={settings.markdownFont.fontFamily} setDraftMarkdownFontFamily={(value) => setMarkdown('fontFamily', value)}
    draftMarkdownCodeFontFamily={settings.markdownFont.codeFontFamily} setDraftMarkdownCodeFontFamily={(value) => setMarkdown('codeFontFamily', value)}
    draftMarkdownEditorFontFamily={settings.markdownFont.editorFontFamily} setDraftMarkdownEditorFontFamily={(value) => setMarkdown('editorFontFamily', value)}
    draftMarkdownFontSize={settings.markdownFont.fontSize} setDraftMarkdownFontSize={(value) => setMarkdown('fontSize', value)}
    draftMarkdownHeadingWeight={settings.markdownFont.headingFontWeight} setDraftMarkdownHeadingWeight={(value) => setMarkdown('headingFontWeight', value)} />;
  return null;
}
