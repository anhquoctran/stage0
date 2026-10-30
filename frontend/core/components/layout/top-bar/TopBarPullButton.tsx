import { useTranslation as useUiTextTranslation } from 'react-i18next';
import React, { useState, useRef, useEffect } from 'react';
import { Download } from '../../../../common/components/icons/Download';
import { DownloadCloud } from '../../../../common/components/icons/DownloadCloud';
import { ChevronDown } from '../../../../common/components/icons/ChevronDown';
import { useGitStore } from '../../../../features/git/store/useGitStore';
import { useCommandShortcut } from '../../../hooks/useCommandShortcut';

export const TopBarPullButton: React.FC = () => {
  const { t: translateUiText } = useUiTextTranslation();
  const { shortcut, title } = useCommandShortcut();
  const { isSyncing, runSync, setIsPullFromOpen } = useGitStore();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div
      ref={menuRef}
      className={`relative flex items-stretch transition-colors cursor-pointer ${
        isOpen
          ? 'bg-surface0 text-primary'
          : 'text-subtext1 hover:bg-surface0 hover:text-text'
      }`}
    >
      <button
        type="button"
        disabled={isSyncing}
        onClick={() => runSync('pull')}
        className="h-12 px-3 flex flex-col items-center justify-center transition-colors disabled:opacity-40 cursor-pointer min-w-[54px] rounded-sm"
        title={title('pull', 'Pull')}
      >
        <Download className="w-5 h-5 text-primary shrink-0 transition-colors" />
        <span className="text-[11px] font-medium leading-none mt-1.5 tracking-tight transition-colors">
          {translateUiText('menu.commands.pull')}
        </span>
      </button>

      <button
        type="button"
        disabled={isSyncing}
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative flex items-center justify-center px-1.5 h-12 transition-colors cursor-pointer rounded-sm"
        title={title('pull_from', translateUiText('common.layout.pullOptions'))}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute start-0 top-1/2 h-8 w-px -translate-y-1/2 bg-surface1/80"
        />
        <ChevronDown className="w-2.5 h-2.5 text-current transition-colors" />
      </button>

      {isOpen && (
        <div className="absolute start-0 top-full mt-1.5 w-56 shadow-2xl bg-mantle border border-surface0 py-1 z-50 animate-in fade-in duration-100 rounded-sm">
          <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-subtext0 border-b border-surface0 mb-1 rounded-sm">
            {translateUiText('common.layout.pullOptions')}
          </div>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              runSync('pull');
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface0 text-xs text-text hover:text-primary text-start transition-colors cursor-pointer group rounded-sm"
          >
            <div className="flex items-center gap-2">
              <Download className="w-3.5 h-3.5 text-current transition-colors" />
              <span>{translateUiText('menu.commands.pull')}</span>
            </div>
            <span className="text-[10px] text-subtext0 font-mono">{shortcut('pull')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setIsPullFromOpen(true);
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface0 text-xs text-text hover:text-primary text-start transition-colors cursor-pointer group rounded-sm"
          >
            <div className="flex items-center gap-2">
              <DownloadCloud className="w-3.5 h-3.5 text-current transition-colors" />
              <span>{translateUiText('menu.commands.pull_from')}</span>
            </div>
            <span className="text-[10px] text-subtext0 font-mono">{shortcut('pull_from')}</span>
          </button>
        </div>
      )}
    </div>
  );
};
