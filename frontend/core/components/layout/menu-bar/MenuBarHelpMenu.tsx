import React from 'react';
import { Keyboard } from '../../../../common/components/icons/Keyboard';
import { Code2 } from '../../../../common/components/icons/Code2';
import { FileText } from '../../../../common/components/icons/FileText';
import { Info } from '../../../../common/components/icons/Info';
import { invoke } from '@tauri-apps/api/core';

export const MenuBarHelpMenu: React.FC<{
  isOpen: boolean;
  onToggle: () => void;
  onHover: () => void;
  onClose: () => void;
  onOpenShortcuts: () => void;
  onOpenReleaseNotes: () => void;
  onOpenAbout: () => void;
}> = ({
  isOpen,
  onToggle,
  onHover,
  onClose,
  onOpenShortcuts,
  onOpenReleaseNotes,
  onOpenAbout,
}) => {
  return (
    <div className="relative h-full flex items-center">
      <button
        type="button"
        onClick={onToggle}
        onMouseEnter={onHover}
        className={`px-2.5 py-1 text-xs font-normal transition-colors cursor-pointer rounded-sm ${
          isOpen
            ? 'bg-surface1 text-text'
            : 'text-subtext1 hover:text-text hover:bg-surface0'
        }`}
      >
        Help
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-0.5 w-60 shadow-2xl bg-mantle border border-surface0 py-1.5 z-50 text-xs rounded-sm">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenShortcuts();
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer rounded-sm"
          >
            <div className="flex items-center gap-2">
              <Keyboard className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
              <span>Keyboard Shortcuts</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              void invoke('open_webview_devtools');
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer rounded-sm"
          >
            <div className="flex items-center gap-2">
              <Code2 className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
              <span>Developer Tools</span>
            </div>
          </button>

          <div className="my-1 border-t border-surface0" />

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenReleaseNotes();
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer rounded-sm"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
              <span>View release notes</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenAbout();
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer rounded-sm"
          >
            <div className="flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
              <span>About Stage0</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
