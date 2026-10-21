import React from 'react';
import { FolderOpen } from '../../../../common/components/icons/FolderOpen';
import { History } from '../../../../common/components/icons/History';
import { Copy } from '../../../../common/components/icons/Copy';
import { FileText } from '../../../../common/components/icons/FileText';
import { Globe } from '../../../../common/components/icons/Globe';
import { ExternalLink } from '../../../../common/components/icons/ExternalLink';
import { ArrowUp } from '../../../../common/components/icons/ArrowUp';
import { ArrowDown } from '../../../../common/components/icons/ArrowDown';
import { useGitStore } from '../../../../features/git/store/useGitStore';
import {
  revealInOs,
  getAbsoluteFilePath,
  buildRemoteFileUrl,
} from '../../../../features/git/utils/fileActions';

export const MenuBarEditMenu: React.FC<{
  isOpen: boolean;
  onToggle: () => void;
  onHover: () => void;
  onClose: () => void;
  shortcut: (value: string) => string;
  fileManagerName: string;
}> = ({ isOpen, onToggle, onHover, onClose, shortcut, fileManagerName }) => {
  const {
    currentRepo,
    selectedFile,
    setFileViewTab,
    fetchFileBlame,
    showToast,
    remoteUrl,
    compareBranch,
    setTargetFileForUrl,
    setIsRemoteUrlFromOpen,
    selectPrevFile,
    selectNextFile,
  } = useGitStore();

  return (
    <div className="relative h-full flex items-center">
      <button
        type="button"
        disabled={!currentRepo}
        onClick={onToggle}
        onMouseEnter={() => currentRepo && onHover()}
        className={`px-2.5 py-1 text-xs font-normal transition-colors ${
          !currentRepo
            ? 'text-subtext0/50 cursor-not-allowed'
            : isOpen
              ? 'bg-surface1 text-text cursor-pointer'
              : 'text-subtext1 hover:text-text hover:bg-surface0 cursor-pointer'
        }`}
      >
        Edit
      </button>

      {currentRepo && isOpen && (
        <div className="absolute left-0 top-full mt-0.5 w-68 shadow-2xl bg-mantle border border-surface0 py-1.5 z-50 text-xs">
          <button
            type="button"
            disabled={!currentRepo || !selectedFile}
            onClick={async () => {
              onClose();
              if (currentRepo && selectedFile) {
                try {
                  await revealInOs(currentRepo.local_path, selectedFile.path);
                  showToast('Revealed file in OS File Explorer');
                } catch (err) {
                  showToast(`Failed to open explorer: ${err}`);
                }
              }
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <FolderOpen className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
              <span>Open in {fileManagerName}</span>
            </div>
            <span className="text-[10px] text-subtext0 font-mono">{shortcut('Shift+Alt+R')}</span>
          </button>

          <button
            type="button"
            disabled={!selectedFile}
            onClick={() => {
              onClose();
              if (selectedFile) {
                setFileViewTab('blame');
                fetchFileBlame(selectedFile.path);
              }
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <History className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
              <span>View Git Blame</span>
            </div>
            <span className="text-[10px] text-subtext0 font-mono">{shortcut('Alt+B')}</span>
          </button>

          <div className="my-1 border-t border-surface0" />

          <button
            type="button"
            disabled={!selectedFile}
            onClick={() => {
              onClose();
              if (selectedFile) {
                navigator.clipboard.writeText(selectedFile.path);
                showToast(`Copied relative path: ${selectedFile.path}`);
              }
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Copy className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
              <span>Copy Relative Path</span>
            </div>
            <span className="text-[10px] text-subtext0 font-mono">{shortcut('Ctrl+Shift+C')}</span>
          </button>

          <button
            type="button"
            disabled={!currentRepo || !selectedFile}
            onClick={() => {
              onClose();
              if (currentRepo && selectedFile) {
                const abs = getAbsoluteFilePath(currentRepo.local_path, selectedFile.path);
                navigator.clipboard.writeText(abs);
                showToast('Copied absolute path to clipboard');
              }
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
              <span>Copy Absolute Path</span>
            </div>
            <span className="text-[10px] text-subtext0 font-mono">{shortcut('Shift+Alt+C')}</span>
          </button>

          <div className="my-1 border-t border-surface0" />

          <button
            type="button"
            disabled={!selectedFile}
            onClick={() => {
              onClose();
              if (selectedFile) {
                const effectiveRemote = remoteUrl || (currentRepo ? `https://github.com/${currentRepo.name}` : '');
                if (effectiveRemote) {
                  const ref = compareBranch || 'main';
                  const url = buildRemoteFileUrl(effectiveRemote, ref, selectedFile.path);
                  navigator.clipboard.writeText(url);
                  showToast(`Copied remote file URL (${ref})`);
                } else {
                  showToast('No remote URL configured');
                }
              }
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
              <span>Copy Remote File URL</span>
            </div>
            <span className="text-[10px] text-subtext0 font-mono">{shortcut('Ctrl+Shift+U')}</span>
          </button>

          <button
            type="button"
            disabled={!selectedFile}
            onClick={() => {
              onClose();
              if (selectedFile) {
                setTargetFileForUrl(selectedFile);
                setIsRemoteUrlFromOpen(true);
              }
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
              <span>Copy Remote File URL from...</span>
            </div>
            <span className="text-[10px] text-subtext0 font-mono">{shortcut('Ctrl+Alt+U')}</span>
          </button>

          <div className="my-1 border-t border-surface0" />

          <button
            type="button"
            disabled={!currentRepo}
            onClick={() => {
              selectPrevFile();
              onClose();
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <ArrowUp className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
              <span>Previous File</span>
            </div>
            <span className="text-[10px] text-subtext0 font-mono">Up / K</span>
          </button>

          <button
            type="button"
            disabled={!currentRepo}
            onClick={() => {
              selectNextFile();
              onClose();
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <ArrowDown className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
              <span>Next File</span>
            </div>
            <span className="text-[10px] text-subtext0 font-mono">Down / J</span>
          </button>
        </div>
      )}
    </div>
  );
};

