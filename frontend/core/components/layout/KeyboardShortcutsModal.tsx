import React from 'react';
import { Keyboard } from '../../../common/components/icons/Keyboard';
import { X } from '../../../common/components/icons/X';
import { getMenuShortcutCategories } from '../../services/applicationMenuShortcuts';
import { getOsFileManagerName } from '../../../features/git/utils/fileActions';
import { usePreferencesStore } from '../../../features/preferences/store/usePreferencesStore';

export const KeyboardShortcutsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const { keymap, openPreferences } = usePreferencesStore();
  if (!isOpen) return null;

  const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const fileManagerName = getOsFileManagerName();

  const platform = isMac
    ? 'macos'
    : /Win/i.test(navigator.platform || navigator.userAgent)
      ? 'windows'
      : 'linux';
  const shortcutCategories = getMenuShortcutCategories(platform, fileManagerName, keymap);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 select-none animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
        role="dialog" aria-modal="true" aria-label="Keyboard Shortcuts"
        className="relative bg-mantle border border-surface0 p-5 sm:p-6 max-w-5xl w-full shadow-2xl animate-in zoom-in-95 duration-150 text-text cursor-default rounded-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          data-tauri-drag-region
          className="flex items-center justify-between pb-3.5 border-b border-surface0 cursor-default"
        >
          <div data-tauri-drag-region className="flex items-center gap-2 pointer-events-none">
            <Keyboard className="w-4 h-4 text-brand" />
            <h3 className="text-sm font-bold text-text tracking-tight">Keyboard Shortcuts</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-subtext0 hover:text-text hover:bg-surface0 transition-colors cursor-pointer rounded-sm"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Categories Grid (Max 2 rows on desktop) */}
        <div className="max-h-[70vh] overflow-y-auto py-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
          {shortcutCategories.map((category) => (
            <div key={category.title} className="flex flex-col justify-start">
              <div className="flex items-center gap-2 pb-1.5 mb-2.5 border-b border-surface0/60 text-xs font-semibold text-text rounded-sm">
                <Keyboard className="w-3.5 h-3.5 text-brand" />
                <span>{category.title}</span>
              </div>
              <div className="space-y-1.5">
                {category.items.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-3 text-xs py-0.5 px-1 -mx-1 hover:bg-surface0/30 transition-colors group rounded-sm"
                  >
                    <span
                      className="text-subtext1 group-hover:text-text transition-colors truncate"
                      title={item.label}
                    >
                      {item.label}
                    </span>
                    <span className="font-mono text-xs font-semibold text-blue shrink-0 select-none tracking-tight">
                      {item.keys}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-surface0 flex items-center justify-between">
          <button type="button" className="rounded-sm px-2 py-1 text-xs text-brand hover:bg-surface0" onClick={() => { onClose(); openPreferences('general-keymaps'); }}>Customize keymap…</button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-1.5 bg-surface1 hover:bg-surface2 text-text font-semibold text-xs cursor-pointer transition-colors border border-surface1 hover:border-surface2 rounded-sm"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
