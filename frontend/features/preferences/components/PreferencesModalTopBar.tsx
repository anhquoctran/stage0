import React from 'react';
import { useTranslation } from 'react-i18next';
import { X } from '../../../common/components/icons/X';
import { isMacOS } from '../../../common/utils/shortcuts';
import { useWindowChromeStore } from '../../../core/store/useWindowChromeStore';
import { useApplicationServices } from '../../../core/services/runtime/useApplicationServices';

export const PreferencesModalTopBar: React.FC<{
  onOpenJsonEditor: () => void;
  onClose: () => void;
  standalone?: boolean;
  disabled?: boolean;
}> = ({ onOpenJsonEditor, onClose, standalone = false, disabled = false }) => {
  const { t } = useTranslation();
  const title = t('menu.commands.preferences').replace(/[.…]+$/u, '');
  const services = useApplicationServices();
  const profile = useWindowChromeStore(state => state.profile);
  const custom = standalone && !profile.nativeFrame;
  const mac = standalone && (profile.platform === 'macos' || (!profile.platform && isMacOS()));
  const closeButton = <button
    type="button"
    disabled={disabled}
    onClick={onClose}
    data-macos-traffic-light={custom && mac ? true : undefined}
    className={custom && mac
      ? 'btn-solid preferences-window-close rounded-full bg-[#ff5f56] cursor-pointer'
      : 'me-2 flex h-7 w-7 items-center justify-center text-subtext0 hover:text-text hover:bg-surface0/70 transition-colors cursor-pointer rounded-sm'}
    title={custom && mac ? undefined : t('common.close')}
    aria-label={`${t('common.close')} ${title}`}
  >
    {custom && mac ? <svg
      width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"
      fill="#4d0000"
    >
      <path d="M1.8 1 4 3.2 6.2 1 7 1.8 4.8 4 7 6.2 6.2 7 4 4.8 1.8 7 1 6.2 3.2 4 1 1.8Z" />
    </svg> : <X className="h-4 w-4" />}
  </button>;
  return (
    <div
      dir="ltr"
      onMouseDown={custom ? event => {
        if (event.button !== 0 || event.detail !== 1) return;
        if ((event.target as Element).closest('button, input, select, textarea, a, [role="button"], [contenteditable]')) return;
        event.preventDefault();
        void services.application.windowStartDragging().catch(error => console.warn('Could not move Preferences:', error));
      } : undefined}
      className={`${standalone ? 'h-8.5' : 'h-10'} bg-mantle/60 border-b border-surface0/50 flex items-center justify-between shrink-0 select-none rounded-t-sm cursor-default`}
    >
      <div className="flex h-full min-w-0 items-center gap-4 ps-3">
        {custom && mac && closeButton}
        <span dir="auto" className="text-xs font-bold tracking-tight text-text">{title}</span>
      </div>
      <div className="flex h-full items-center">
        <button
          type="button"
          disabled={disabled}
          onClick={onOpenJsonEditor}
          className="me-2 border border-surface0 px-2.5 py-1 text-[11px] text-subtext1 hover:bg-surface0 hover:text-text cursor-pointer rounded-sm"
          title={t('preferences.editorActions.editFileTitle')}
        >
          {t('preferences.editorActions.editFile')}
        </button>
        {(!standalone || (custom && !mac)) && closeButton}
      </div>
    </div>
  );
};
