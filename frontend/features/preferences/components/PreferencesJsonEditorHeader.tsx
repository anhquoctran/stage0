import { X } from '../../../common/components/icons/X';
import { useTranslation as useUiTextTranslation } from 'react-i18next';
import type { PreferencesJsonEditorHeaderProps } from './PreferencesJsonEditorHeaderProps';

export function PreferencesJsonEditorHeader({
  isMac,
  title,
  description,
  saveState,
  handleClose,
}: PreferencesJsonEditorHeaderProps) {
  const { t: translateUiText } = useUiTextTranslation();
  return (
    <header
      className={`flex shrink-0 items-center justify-between border-b border-surface0 ${isMac ? 'pl-16 pe-4' : 'px-4'} py-3`}
    >
      <div>
        <h2 className="text-sm font-semibold">{title ?? translateUiText('preferences.jsonEditor.editTitle')}</h2>
        <p className="mt-1 text-xs text-subtext0">
          {description ?? translateUiText('preferences.jsonEditor.description')}
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
          autoFocus
          onClick={() => void handleClose()}
          aria-label={translateUiText('preferences.jsonEditor.closeEditor')}
          title={translateUiText('preferences.jsonEditor.closeEditor')}
          className="shrink-0 border-0 p-2 text-subtext0 hover:bg-surface0 hover:text-text rounded-sm"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
