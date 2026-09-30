import React, { useState, useRef, useEffect } from 'react';
import {
  FolderOpen,
  Copy,
  FileText,
  Globe,
  ExternalLink,
  MoreHorizontal,
  ChevronDown,
  History,
} from '@/components/common/icons';
import { ChangedFile } from '../../types/git';
import { useGitStore } from '../../store/useGitStore';
import {
  revealInOs,
  getAbsoluteFilePath,
  buildRemoteFileUrl,
} from '../../utils/fileActions';
import { formatShortcutText } from '../../utils/shortcuts';

interface FileActionMenuProps {
  file: ChangedFile | null;
  className?: string;
}

export const FileActionMenu: React.FC<FileActionMenuProps> = ({ file, className = '' }) => {
  const {
    currentRepo,
    remoteUrl,
    compareBranch,
    showToast,
    setIsRemoteUrlFromOpen,
    setTargetFileForUrl,
    setFileViewTab,
    fetchFileBlame,
    selectFile,
  } = useGitStore();

  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (!file) return null;

  const handleReveal = async () => {
    setIsOpen(false);
    if (!currentRepo) return;
    try {
      await revealInOs(currentRepo.local_path, file.path);
      showToast('Revealed file in OS File Explorer');
    } catch (err) {
      showToast(`Failed to open explorer: ${err}`);
    }
  };

  const handleViewBlame = () => {
    setIsOpen(false);
    if (file.is_binary) return;
    selectFile(file);
    setFileViewTab('blame');
    fetchFileBlame(file.path);
  };

  const handleCopyRelative = () => {
    setIsOpen(false);
    navigator.clipboard.writeText(file.path);
    showToast(`Copied relative path: ${file.path}`);
  };

  const handleCopyAbsolute = () => {
    setIsOpen(false);
    if (!currentRepo) return;
    const absPath = getAbsoluteFilePath(currentRepo.local_path, file.path);
    navigator.clipboard.writeText(absPath);
    showToast('Copied absolute path to clipboard');
  };

  const handleCopyRemoteUrl = () => {
    setIsOpen(false);
    const effectiveRemote = remoteUrl || (currentRepo ? `https://github.com/${currentRepo.name}` : '');
    if (!effectiveRemote) {
      showToast('No remote URL configured for this repository');
      return;
    }
    const ref = compareBranch || 'main';
    const url = buildRemoteFileUrl(effectiveRemote, ref, file.path);
    navigator.clipboard.writeText(url);
    showToast(`Copied remote file URL (${ref})`);
  };

  const handleCopyRemoteUrlFrom = () => {
    setIsOpen(false);
    setTargetFileForUrl(file);
    setIsRemoteUrlFromOpen(true);
  };

  return (
    <div className={`relative inline-flex items-center ${className}`} ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="File actions (Reveal in Explorer, Copy paths, Copy remote URL)"
        className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors border cursor-pointer ${
          isOpen
            ? 'bg-surface1 text-text border-surface2'
            : 'bg-surface0 border-surface0 text-subtext1 hover:text-text hover:bg-surface1'
        }`}
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Actions</span>
        <ChevronDown className="w-2.5 h-2.5 opacity-70" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-72 shadow-2xl bg-mantle border border-surface0 py-1 z-50 text-xs animate-in fade-in duration-100">
          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-subtext0 border-b border-surface0/70 mb-1 truncate">
            {file.path.split('/').pop() || file.path}
          </div>

          <button
            type="button"
            onClick={handleReveal}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors cursor-pointer group whitespace-nowrap"
          >
            <div className="flex items-center gap-2">
              <FolderOpen className="w-3.5 h-3.5 text-subtext1 group-hover:text-text shrink-0" />
              <span>Open in File Explorer</span>
            </div>
            <span className="text-[10px] text-subtext0 font-mono ml-3">{formatShortcutText('Shift+Alt+R')}</span>
          </button>

          {!file.is_binary && (
            <button
              type="button"
              onClick={handleViewBlame}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors cursor-pointer group whitespace-nowrap"
            >
              <div className="flex items-center gap-2">
                <History className="w-3.5 h-3.5 text-subtext1 group-hover:text-text shrink-0" />
                <span>View Git Blame</span>
              </div>
              <span className="text-[10px] text-subtext0 font-mono ml-3">{formatShortcutText('Alt+B')}</span>
            </button>
          )}

          <div className="my-1 border-t border-surface0" />

          <button
            type="button"
            onClick={handleCopyRelative}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors cursor-pointer group whitespace-nowrap"
          >
            <div className="flex items-center gap-2">
              <Copy className="w-3.5 h-3.5 text-subtext1 group-hover:text-text shrink-0" />
              <span>Copy Relative Path</span>
            </div>
            <span className="text-[10px] text-subtext0 font-mono ml-3">{formatShortcutText('Ctrl+Shift+C')}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyAbsolute}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors cursor-pointer group whitespace-nowrap"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-subtext1 group-hover:text-text shrink-0" />
              <span>Copy Absolute Path</span>
            </div>
            <span className="text-[10px] text-subtext0 font-mono ml-3">{formatShortcutText('Shift+Alt+C')}</span>
          </button>

          <div className="my-1 border-t border-surface0" />

          <button
            type="button"
            onClick={handleCopyRemoteUrl}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors cursor-pointer group whitespace-nowrap"
          >
            <div className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-subtext1 group-hover:text-text shrink-0" />
              <span>Copy Remote File URL</span>
            </div>
            <span className="text-[10px] text-subtext0 font-mono ml-3">{formatShortcutText('Ctrl+Shift+U')}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyRemoteUrlFrom}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors cursor-pointer group whitespace-nowrap"
          >
            <div className="flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5 text-subtext1 group-hover:text-text shrink-0" />
              <span>Copy Remote File URL from...</span>
            </div>
            <span className="text-[10px] text-subtext0 font-mono ml-3">{formatShortcutText('Ctrl+Alt+U')}</span>
          </button>
        </div>
      )}
    </div>
  );
};

interface FileContextMenuProps {
  x: number;
  y: number;
  file: ChangedFile;
  onClose: () => void;
}

export const FileContextMenu: React.FC<FileContextMenuProps> = ({
  x,
  y,
  file,
  onClose,
}) => {
  const {
    currentRepo,
    remoteUrl,
    compareBranch,
    showToast,
    setIsRemoteUrlFromOpen,
    setTargetFileForUrl,
    setFileViewTab,
    fetchFileBlame,
    selectFile,
  } = useGitStore();

  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click or escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Adjust coordinates so menu does not overflow viewport
  const menuWidth = 288;
  const menuHeight = 220;
  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 8);
  const adjustedY = Math.min(y, window.innerHeight - menuHeight - 8);

  const handleReveal = async () => {
    onClose();
    if (!currentRepo) return;
    try {
      await revealInOs(currentRepo.local_path, file.path);
      showToast('Revealed file in OS File Explorer');
    } catch (err) {
      showToast(`Failed to open explorer: ${err}`);
    }
  };

  const handleViewBlame = () => {
    onClose();
    if (file.is_binary) return;
    selectFile(file);
    setFileViewTab('blame');
    fetchFileBlame(file.path);
  };

  const handleCopyRelative = () => {
    onClose();
    navigator.clipboard.writeText(file.path);
    showToast(`Copied relative path: ${file.path}`);
  };

  const handleCopyAbsolute = () => {
    onClose();
    if (!currentRepo) return;
    const absPath = getAbsoluteFilePath(currentRepo.local_path, file.path);
    navigator.clipboard.writeText(absPath);
    showToast('Copied absolute path to clipboard');
  };

  const handleCopyRemoteUrl = () => {
    onClose();
    const effectiveRemote = remoteUrl || (currentRepo ? `https://github.com/${currentRepo.name}` : '');
    if (!effectiveRemote) {
      showToast('No remote URL configured for this repository');
      return;
    }
    const ref = compareBranch || 'main';
    const url = buildRemoteFileUrl(effectiveRemote, ref, file.path);
    navigator.clipboard.writeText(url);
    showToast(`Copied remote file URL (${ref})`);
  };

  const handleCopyRemoteUrlFrom = () => {
    onClose();
    setTargetFileForUrl(file);
    setIsRemoteUrlFromOpen(true);
  };

  return (
    <div
      ref={menuRef}
      style={{ left: `${adjustedX}px`, top: `${adjustedY}px` }}
      className="fixed z-50 w-72 shadow-2xl bg-mantle border border-surface0 py-1.5 text-xs animate-in fade-in duration-75 select-none"
    >
      <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-subtext0 border-b border-surface0/70 mb-1 truncate">
        {file.path.split('/').pop() || file.path}
      </div>

      <button
        type="button"
        onClick={handleReveal}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors cursor-pointer group whitespace-nowrap"
      >
        <div className="flex items-center gap-2">
          <FolderOpen className="w-3.5 h-3.5 text-subtext1 group-hover:text-text shrink-0" />
          <span>Open in File Explorer</span>
        </div>
        <span className="text-[10px] text-subtext0 font-mono ml-3">{formatShortcutText('Shift+Alt+R')}</span>
      </button>

      {!file.is_binary && (
        <button
          type="button"
          onClick={handleViewBlame}
          className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors cursor-pointer group whitespace-nowrap"
        >
          <div className="flex items-center gap-2">
            <History className="w-3.5 h-3.5 text-subtext1 group-hover:text-text shrink-0" />
            <span>View Git Blame</span>
          </div>
          <span className="text-[10px] text-subtext0 font-mono ml-3">{formatShortcutText('Alt+B')}</span>
        </button>
      )}

      <div className="my-1 border-t border-surface0" />

      <button
        type="button"
        onClick={handleCopyRelative}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors cursor-pointer group whitespace-nowrap"
      >
        <div className="flex items-center gap-2">
          <Copy className="w-3.5 h-3.5 text-subtext1 group-hover:text-text shrink-0" />
          <span>Copy Relative Path</span>
        </div>
        <span className="text-[10px] text-subtext0 font-mono ml-3">{formatShortcutText('Ctrl+Shift+C')}</span>
      </button>

      <button
        type="button"
        onClick={handleCopyAbsolute}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors cursor-pointer group whitespace-nowrap"
      >
        <div className="flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-subtext1 group-hover:text-text shrink-0" />
          <span>Copy Absolute Path</span>
        </div>
        <span className="text-[10px] text-subtext0 font-mono ml-3">{formatShortcutText('Shift+Alt+C')}</span>
      </button>

      <div className="my-1 border-t border-surface0" />

      <button
        type="button"
        onClick={handleCopyRemoteUrl}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors cursor-pointer group whitespace-nowrap"
      >
        <div className="flex items-center gap-2">
          <Globe className="w-3.5 h-3.5 text-subtext1 group-hover:text-text shrink-0" />
          <span>Copy Remote File URL</span>
        </div>
        <span className="text-[10px] text-subtext0 font-mono ml-3">{formatShortcutText('Ctrl+Shift+U')}</span>
      </button>

      <button
        type="button"
        onClick={handleCopyRemoteUrlFrom}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors cursor-pointer group whitespace-nowrap"
      >
        <div className="flex items-center gap-2">
          <ExternalLink className="w-3.5 h-3.5 text-subtext1 group-hover:text-text shrink-0" />
          <span>Copy Remote File URL from...</span>
        </div>
        <span className="text-[10px] text-subtext0 font-mono ml-3">{formatShortcutText('Ctrl+Alt+U')}</span>
      </button>
    </div>
  );
};
