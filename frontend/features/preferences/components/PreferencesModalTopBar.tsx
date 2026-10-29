import React from 'react';
import { useTranslation } from 'react-i18next';
import { X } from '../../../common/components/icons/X';
import { isMacOS } from '../../../common/utils/shortcuts';
import { WindowControls } from '../../../core/components/layout/WindowControls';
import { titleBarMouseDown } from '../../../core/components/layout/top-bar/titleBarMouseDown';
import { useWindowChromeStore } from '../../../core/store/useWindowChromeStore';
import { useApplicationServices } from '../../../core/services/runtime/useApplicationServices';

export const PreferencesModalTopBar: React.FC<{
  onOpenJsonEditor: () => void;
  onClose: () => void;
  standalone?: boolean;
}> = ({ onOpenJsonEditor, onClose, standalone = false }) => {
  const { t } = useTranslation();
  const title = t('menu.commands.preferences').replace(/[.…]+$/u, '');
  const services = useApplicationServices();
  const profile = useWindowChromeStore(state => state.profile);
  const custom = standalone && !profile.nativeFrame;
  const mac = standalone && (profile.platform === 'macos' || (!profile.platform && isMacOS()));
  const linux = profile.platform === 'linux';
  return (
    <div
      dir="ltr"
      data-tauri-drag-region={custom && !linux}
      onMouseDown={custom ? titleBarMouseDown(profile, services.application, mac) : undefined}
      className={`${standalone ? 'h-8.5' : 'h-10'} bg-crust border-b border-surface0/80 flex items-center justify-between shrink-0 select-none rounded-none cursor-default`}
    >
      <div className="flex h-full min-w-0 items-center gap-4 ps-3">
        {custom && mac && <WindowControls style="mac" />}
        {custom && linux && profile.controlsLeft.length > 0 && <WindowControls style="windows" buttons={profile.controlsLeft} />}
        <span dir="auto" className="text-xs font-bold tracking-tight text-text">{title}</span>
      </div>
      <div className="flex h-full items-center">
        <button
          type="button"
          onClick={onOpenJsonEditor}
          className="me-2 border border-surface0 px-2.5 py-1 text-[11px] text-subtext1 hover:bg-surface0 hover:text-text cursor-pointer rounded-sm"
          title="Edit the app preferences JSONC file"
        >
          Edit in preferences.json
        </button>
        {custom && !mac && <WindowControls style="windows" buttons={linux ? profile.controlsRight : undefined} />}
        {!standalone && <button
          type="button"
          onClick={onClose}
          className="flex h-full w-11 items-center justify-center text-subtext0 hover:text-text hover:bg-surface0/70 transition-colors cursor-pointer rounded-sm"
          title={`${t('common.close')} (Esc)`}
          aria-label={`${t('common.close')} ${title}`}
        >
          <X className="w-4 h-4" />
        </button>}
      </div>
    </div>
  );
};
