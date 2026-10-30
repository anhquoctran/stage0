import React, { useEffect } from 'react';
import { SettingRow } from '../SettingRow';
import { Undo2 } from '../../../../common/components/icons/Undo2';
import { CustomSelect } from '../../../../common/components/CustomSelect';
import {
  DEFAULT_MARKDOWN_FONT_SETTINGS,
  MARKDOWN_PROSE_FONTS,
  MARKDOWN_CODE_FONTS,
  MARKDOWN_EDITOR_FONTS,
} from '../../constants/markdownFonts';
import { applyMarkdownFontToDocument } from '../../utils/applyMarkdownFontToDocument';
import { useTranslation } from 'react-i18next';

export const PreferencesMarkdownFontTab: React.FC<{
  draftMarkdownFontFamily: string;
  setDraftMarkdownFontFamily: React.Dispatch<React.SetStateAction<string>>;
  draftMarkdownCodeFontFamily: string;
  setDraftMarkdownCodeFontFamily: React.Dispatch<React.SetStateAction<string>>;
  draftMarkdownEditorFontFamily: string;
  setDraftMarkdownEditorFontFamily: React.Dispatch<React.SetStateAction<string>>;
  draftMarkdownFontSize: number;
  setDraftMarkdownFontSize: React.Dispatch<React.SetStateAction<number>>;
  draftMarkdownHeadingWeight: number;
  setDraftMarkdownHeadingWeight: React.Dispatch<React.SetStateAction<number>>;
  editorFontFamily?: string;
  editorFontSize?: number;
  showPreview?: boolean;
}> = ({
  draftMarkdownFontFamily, setDraftMarkdownFontFamily,
  draftMarkdownCodeFontFamily, setDraftMarkdownCodeFontFamily,
  draftMarkdownEditorFontFamily, setDraftMarkdownEditorFontFamily,
  draftMarkdownFontSize, setDraftMarkdownFontSize,
  draftMarkdownHeadingWeight, setDraftMarkdownHeadingWeight,
  showPreview = true,
}) => {
  const { t } = useTranslation();
  useEffect(() => {
    applyMarkdownFontToDocument({
      fontFamily: draftMarkdownFontFamily,
      codeFontFamily: draftMarkdownCodeFontFamily,
      editorFontFamily: draftMarkdownEditorFontFamily,
      fontSize: draftMarkdownFontSize,
      headingFontWeight: draftMarkdownHeadingWeight,
    });
  }, [draftMarkdownFontFamily, draftMarkdownCodeFontFamily, draftMarkdownEditorFontFamily,
    draftMarkdownFontSize, draftMarkdownHeadingWeight]);

  const fontRows = [
    {
      title: t('preferences.markdownFont.family'),
      description: t('preferences.markdownFont.familyDescription'),
      value: draftMarkdownFontFamily, onChange: setDraftMarkdownFontFamily,
      defaultValue: DEFAULT_MARKDOWN_FONT_SETTINGS.fontFamily, fonts: MARKDOWN_PROSE_FONTS,
    },
    {
      title: t('preferences.markdownFont.codeFamily'),
      description: t('preferences.markdownFont.codeFamilyDescription'),
      value: draftMarkdownCodeFontFamily, onChange: setDraftMarkdownCodeFontFamily,
      defaultValue: DEFAULT_MARKDOWN_FONT_SETTINGS.codeFontFamily, fonts: MARKDOWN_CODE_FONTS,
    },
    {
      title: t('preferences.markdownFont.editorFont'),
      description: t('preferences.markdownFont.editorFontDescription'),
      value: draftMarkdownEditorFontFamily, onChange: setDraftMarkdownEditorFontFamily,
      defaultValue: DEFAULT_MARKDOWN_FONT_SETTINGS.editorFontFamily, fonts: MARKDOWN_EDITOR_FONTS,
    },
  ];
  const numberRows = [
    {
      title: t('preferences.markdownFont.size'),
      description: t('preferences.markdownFont.sizeDescription'),
      onChange: setDraftMarkdownFontSize,
      defaultValue: DEFAULT_MARKDOWN_FONT_SETTINGS.fontSize, min: 10, max: 32, step: 1,
      formatted: draftMarkdownFontSize.toFixed(2), action: t('preferences.markdownFont.fontSizeAction'),
    },
    {
      title: t('preferences.markdownFont.headingWeight'),
      description: t('preferences.markdownFont.headingWeightDescription'),
      onChange: setDraftMarkdownHeadingWeight,
      defaultValue: DEFAULT_MARKDOWN_FONT_SETTINGS.headingFontWeight, min: 100, max: 900, step: 100,
      formatted: String(draftMarkdownHeadingWeight), action: t('preferences.markdownFont.headingWeightAction'),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="text-xs font-mono font-semibold tracking-wider text-subtext0 select-none pb-1 border-b border-surface0/30">
        {t('preferences.markdownFont.settingsTitle')}
      </div>
      <div className="space-y-1">
        {fontRows.map((row) => (
          <SettingRow key={row.title} description={row.description} title={
            <div className="flex items-center gap-1.5">
              <span>{row.title}</span>
              <button type="button" onClick={() => row.onChange(row.defaultValue)}
                title={t('preferences.markdownFont.resetToDefault', { name: row.title, value: row.defaultValue })}
                className="text-subtext0 hover:text-text cursor-pointer transition-colors p-0.5 rounded-sm">
                <Undo2 className="w-3 h-3" />
              </button>
            </div>
          }>
            <div style={{ fontFamily: row.value }}>
              <CustomSelect value={row.value} onChange={row.onChange} aria-label={row.title}
                options={[...new Set([row.value, ...row.fonts])].filter(Boolean).map((font) => ({ value: font, label: font }))}
                className="w-56" buttonClassName="w-full" dropdownWidth="w-60" searchable />
            </div>
          </SettingRow>
        ))}
        {numberRows.map((row, index) => (
          <SettingRow key={row.title} description={row.description} borderBottom={index === 0} title={
            <div className="flex items-center gap-1.5">
              <span>{row.title}</span>
              <button type="button" onClick={() => row.onChange(row.defaultValue)}
                title={t('preferences.markdownFont.resetToDefault', { name: row.action, value: row.defaultValue })}
                className="text-subtext0 hover:text-text cursor-pointer transition-colors p-0.5 rounded-sm">
                <Undo2 className="w-3 h-3" />
              </button>
            </div>
          }>
            <div className="flex items-center border border-surface0 bg-crust rounded-sm overflow-hidden shadow-2xs">
              <button type="button" onClick={() => row.onChange((previous) => Math.max(row.min, previous - row.step))}
                title={t('preferences.markdownFont.decrease', { name: row.action })}
                className="px-2.5 py-1 hover:bg-surface0 text-subtext0 hover:text-text cursor-pointer font-bold transition-colors select-none rounded-sm">-</button>
              <span className="px-3 py-1 font-mono text-xs text-text text-center min-w-[58px] select-none">{row.formatted}</span>
              <button type="button" onClick={() => row.onChange((previous) => Math.min(row.max, previous + row.step))}
                title={t('preferences.markdownFont.increase', { name: row.action })}
                className="px-2.5 py-1 hover:bg-surface0 text-subtext0 hover:text-text cursor-pointer font-bold transition-colors select-none rounded-sm">+</button>
            </div>
          </SettingRow>
        ))}
      </div>
      {showPreview && <div className="mt-6 pt-4 border-t border-surface0/60 space-y-2">
        <label htmlFor="markdown-editor-font-preview" className="text-[11px] font-mono uppercase tracking-wider text-subtext0">
          {t('preferences.markdownFont.editorPreview')}
        </label>
        <textarea id="markdown-editor-font-preview" aria-label={t('preferences.markdownFont.editorPreview')} readOnly rows={3}
          value={t('preferences.markdownFont.editorPreviewSample')}
          className="markdown-editor-textarea w-full p-3 bg-crust border border-surface0 rounded-sm text-xs text-text resize-none" />
        <div className="text-[11px] font-mono uppercase tracking-wider text-subtext0">{t('preferences.markdownFont.livePreview')}</div>
        <div className="markdown-preview p-4 rounded-sm bg-crust border border-surface0 select-text"
          style={{ fontFamily: draftMarkdownFontFamily, fontSize: `${draftMarkdownFontSize}px` }}>
          <h2 style={{ fontWeight: draftMarkdownHeadingWeight, borderBottom: '1px solid var(--ctp-surface0)', paddingBottom: '0.2em', marginBottom: '0.4em' }}>
            {t('preferences.markdownFont.previewHeader')}
          </h2>
          <p className="text-subtext1 mb-2">
            {t('preferences.markdownFont.previewParagraph', { font: draftMarkdownFontFamily, size: draftMarkdownFontSize })}
          </p>
          <pre className="p-2.5 rounded-sm bg-surface0/40 border border-surface1/40 overflow-x-auto text-xs"
            style={{ fontFamily: draftMarkdownCodeFontFamily }}>
            <code>{`function previewCodeBlock() {\n  const font = "${draftMarkdownCodeFontFamily}";\n  return font;\n}`}</code>
          </pre>
        </div>
      </div>}
    </div>
  );
};
