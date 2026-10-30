import { useTranslation as useUiTextTranslation } from 'react-i18next';
import type { PreferencesJsonEditorHeaderProps } from './PreferencesJsonEditorHeaderProps';

export function PreferencesJsonEditorHeader({
  isMac,
  saveState,
  handleClose,
}: PreferencesJsonEditorHeaderProps) {
  const { t: translateUiText } = useUiTextTranslation();
  return (
    <header
      className={`flex shrink-0 items-center justify-between border-b border-surface0 ${isMac ? 'pl-16 pe-4' : 'px-4'} py-3`}
    >
      <div>
        <h2 className="text-sm font-semibold">{translateUiText('preferences.jsonEditor.editTitle')}</h2>
        <p className="mt-1 text-xs text-subtext0">
          {translateUiText('preferences.jsonEditor.description')}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={`text-xs ${saveState === 'invalid' || saveState === 'conflict' || saveState === 'error' ? 'text-red' : 'text-subtext0'}`}
          role="status"
        >
          {translateUiText(`preferences.jsonEditor.saveState.${saveState}`)}
        </span>
        <button
          type="button"
          onClick={() => void handleClose()}
          className="border border-surface1 px-3 py-1.5 text-xs hover:bg-surface0 rounded-sm"
        >
          {translateUiText('preferences.jsonEditor.backToPreferences')}
        </button>
      </div>
    </header>
  );
}
