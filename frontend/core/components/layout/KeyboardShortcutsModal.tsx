import React from 'react';
import { FolderOpen } from '../../../common/components/icons/FolderOpen';
import { GitMerge } from '../../../common/components/icons/GitMerge';
import { Terminal } from '../../../common/components/icons/Terminal';
import { Columns2 } from '../../../common/components/icons/Columns2';
import { ArrowDown } from '../../../common/components/icons/ArrowDown';
import { Copy } from '../../../common/components/icons/Copy';
import { Keyboard } from '../../../common/components/icons/Keyboard';
import { X } from '../../../common/components/icons/X';
import { formatShortcutText } from '../../../common/utils/shortcuts';
import { getOsFileManagerName } from '../../../features/git/utils/fileActions';

export const KeyboardShortcutsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const shortcut = (value: string) => formatShortcutText(value, isMac);
  const fileManagerName = getOsFileManagerName();

  const shortcutCategories = [
    {
      title: 'General & Workspace',
      icon: <FolderOpen className="w-3.5 h-3.5 text-brand" />,
      items: [
        { label: 'Open Repository', keys: shortcut('Ctrl+O') },
        { label: 'Preferences', keys: shortcut('Ctrl+,') },
        { label: 'Refresh Virtual Diff', keys: shortcut('Ctrl+R') },
      ],
    },
    {
      title: 'Git Synchronization',
      icon: <GitMerge className="w-3.5 h-3.5 text-brand" />,
      items: [
        { label: 'Fetch (All & Prune)', keys: shortcut('Ctrl+Shift+F') },
        { label: 'Pull', keys: shortcut('Ctrl+Shift+P') },
        { label: 'Pull from... (Advanced)', keys: shortcut('Ctrl+Alt+P') },
        { label: 'Merge Upstream', keys: shortcut('Ctrl+Shift+M') },
        { label: 'Merge from... (Options)', keys: shortcut('Ctrl+Alt+M') },
        { label: 'Rebase', keys: shortcut('Ctrl+Shift+R') },
        { label: 'Rebase from... (Advanced)', keys: shortcut('Ctrl+Alt+R') },
      ],
    },
    {
      title: 'External Tools',
      icon: <Terminal className="w-3.5 h-3.5 text-brand" />,
      items: [
        { label: 'Open Repo in Terminal', keys: shortcut('Alt+Shift+T') },
        { label: 'Open Repo in VS Code', keys: shortcut('Alt+Shift+V') },
        { label: `Open Repo in ${fileManagerName}`, keys: shortcut('Alt+Shift+E') },
        { label: `Open File in ${fileManagerName}`, keys: shortcut('Shift+Alt+R') },
      ],
    },
    {
      title: 'Diff & View Mode',
      icon: <Columns2 className="w-3.5 h-3.5 text-brand" />,
      items: [
        { label: 'Side-by-side Split Diff', keys: 'S' },
        { label: 'Inline Unified Diff', keys: 'U' },
        { label: 'Toggle Git Blame View', keys: shortcut('Alt+B') },
        { label: 'Display Performance Monitor', keys: shortcut('Ctrl+Shift+F12') },
      ],
    },
    {
      title: 'File Navigation',
      icon: <ArrowDown className="w-3.5 h-3.5 text-brand" />,
      items: [
        { label: 'Select Next File', keys: 'Down / J' },
        { label: 'Select Previous File', keys: 'Up / K' },
        { label: 'Select Next Conflict', keys: shortcut('Alt+C') },
      ],
    },
    {
      title: 'Copy Paths & URLs',
      icon: <Copy className="w-3.5 h-3.5 text-brand" />,
      items: [
        { label: 'Copy Relative Path', keys: shortcut('Ctrl+Shift+C') },
        { label: 'Copy Absolute Path', keys: shortcut('Shift+Alt+C') },
        { label: 'Copy Remote File URL', keys: shortcut('Ctrl+Shift+U') },
        { label: 'Copy Remote File URL from...', keys: shortcut('Ctrl+Alt+U') },
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 select-none animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
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
        <div className="py-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
          {shortcutCategories.map((category) => (
            <div
              key={category.title}
              className="flex flex-col justify-start"
            >
              <div className="flex items-center gap-2 pb-1.5 mb-2.5 border-b border-surface0/60 text-xs font-semibold text-text rounded-sm">
                {category.icon}
                <span>{category.title}</span>
              </div>
              <div className="space-y-1.5">
                {category.items.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-3 text-xs py-0.5 px-1 -mx-1 hover:bg-surface0/30 transition-colors group rounded-sm"
                  >
                    <span className="text-subtext1 group-hover:text-text transition-colors truncate" title={item.label}>
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
          <span className="text-[11px] text-subtext0 font-mono">Press Esc to close</span>
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

