import React, { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Download,
  X,
  Folder,
  FolderOpen,
  Globe,
  Terminal,
  AlertCircle,
  Loader2,
  Check,
} from '@/components/common/icons';
import { useGitStore } from '../../store/useGitStore';

type UrlValidationStatus = 'idle' | 'validating' | 'valid' | 'invalid';

export const CloneRepoModal: React.FC = () => {
  const {
    isCloneModalOpen,
    setIsCloneModalOpen,
    cloneRepo,
    pickCloneFolder,
  } = useGitStore();

  const [remoteUrl, setRemoteUrl] = useState('');
  const [parentDir, setParentDir] = useState(() => {
    try {
      return localStorage.getItem('stage0_last_clone_dir') || '';
    } catch {
      return '';
    }
  });
  const [repoName, setRepoName] = useState('');
  const [isCloning, setIsCloning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // URL Validation State
  const [urlStatus, setUrlStatus] = useState<UrlValidationStatus>('idle');
  const [urlMessage, setUrlMessage] = useState<string | null>(null);

  // Auto-extract repo name from remote URL
  const extractRepoName = (url: string): string => {
    const trimmed = url.trim().replace(/\/+$/, '');
    if (!trimmed) return '';
    // Handle git@github.com:org/repo.git or https://github.com/org/repo.git
    const match = trimmed.match(/\/([^/]+?)(\.git)?$/) || trimmed.match(/:([^/:]+?)(\.git)?$/);
    if (match && match[1]) {
      return match[1].replace(/\.git$/, '');
    }
    return '';
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setRemoteUrl(val);
    setErrorMessage(null);
    const inferred = extractRepoName(val);
    if (inferred) {
      setRepoName(inferred);
    }
  };

  // Debounce 1s then validate URL format and remote availability
  useEffect(() => {
    const trimmed = remoteUrl.trim();
    if (!trimmed) {
      setUrlStatus('idle');
      setUrlMessage(null);
      return;
    }

    const isBasicFormat =
      trimmed.startsWith('https://') ||
      trimmed.startsWith('http://') ||
      trimmed.startsWith('git@') ||
      trimmed.startsWith('ssh://');

    if (!isBasicFormat) {
      setUrlStatus('invalid');
      setUrlMessage('Invalid URL format (must start with https://, git@ or ssh://)');
      return;
    }

    setUrlStatus('validating');
    setUrlMessage('Checking connection to repository...');

    const timer = setTimeout(async () => {
      try {
        const res = await invoke<string>('check_remote_repo_url', { url: trimmed });
        setUrlStatus('valid');
        setUrlMessage(res || 'Repository is valid and ready to clone.');
      } catch (err: unknown) {
        setUrlStatus('invalid');
        setUrlMessage(typeof err === 'string' ? err : 'Repository does not exist or is inaccessible.');
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [remoteUrl]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isCloneModalOpen && !isCloning) {
        setIsCloneModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCloneModalOpen, isCloning, setIsCloneModalOpen]);

  // Compute final destination path
  const destinationPath = useMemo(() => {
    const cleanParent = parentDir.trim().replace(/[/\\]+$/, '');
    const cleanName = repoName.trim();
    if (!cleanParent && !cleanName) return '';
    if (!cleanParent) return cleanName;
    if (!cleanName) return cleanParent;
    const separator = cleanParent.includes('/') ? '/' : '\\';
    return `${cleanParent}${separator}${cleanName}`;
  }, [parentDir, repoName]);

  const handleBrowseFolder = async () => {
    const folder = await pickCloneFolder();
    if (folder) {
      setParentDir(folder);
      try {
        localStorage.setItem('stage0_last_clone_dir', folder);
      } catch {
        // ignore storage errors
      }
      setErrorMessage(null);
    }
  };

  const handleClose = () => {
    if (isCloning) return;
    setIsCloneModalOpen(false);
    setErrorMessage(null);
    setUrlStatus('idle');
    setUrlMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remoteUrl.trim()) {
      setErrorMessage('Please enter a valid repository URL.');
      return;
    }
    if (urlStatus === 'invalid') {
      setErrorMessage(urlMessage || 'Repository URL is invalid or inaccessible.');
      return;
    }
    if (!destinationPath.trim()) {
      setErrorMessage('Please select a destination folder.');
      return;
    }

    setIsCloning(true);
    setErrorMessage(null);

    try {
      await cloneRepo(remoteUrl.trim(), destinationPath.trim());
      setIsCloneModalOpen(false);
      setRemoteUrl('');
      setRepoName('');
      setUrlStatus('idle');
      setUrlMessage(null);
    } catch (err: unknown) {
      setErrorMessage(String(err) || 'Failed to clone repository.');
    } finally {
      setIsCloning(false);
    }
  };

  if (!isCloneModalOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-x-0 bottom-0 top-8.5 z-50 flex items-center justify-center bg-crust/80 backdrop-blur-xs p-4 select-none animate-in fade-in duration-150"
    >
      <div className="bg-mantle border border-surface1 shadow-2xl w-full max-w-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div
          data-tauri-drag-region
          className="px-5 py-4 border-b border-surface0 flex items-center justify-between bg-base/50 cursor-default"
        >
          <div data-tauri-drag-region className="flex items-center gap-2.5 pointer-events-none">
            <div className="p-2 bg-blue/10 text-blue border border-blue/20">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text">Clone Repository</h3>
              <p className="text-[11px] text-subtext0">
                Clone a remote Git repository to your local computer and open in Stage0
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isCloning}
            onClick={handleClose}
            className="p-1.5 hover:bg-surface0 text-subtext0 hover:text-text transition-colors disabled:opacity-40 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 bg-red/10 border border-red/30 flex items-start gap-2.5 text-red text-xs animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 break-words font-mono text-[11px] leading-relaxed">
                {errorMessage}
              </div>
            </div>
          )}

          {/* Remote URL Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-text">
                Repository URL <span className="text-red">*</span>
              </label>
              {urlStatus === 'validating' && (
                <span className="text-[11px] text-blue flex items-center gap-1 font-normal animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Checking...
                </span>
              )}
            </div>
            <div className="relative">
              <Globe
                className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${
                  urlStatus === 'invalid'
                    ? 'text-red'
                    : urlStatus === 'valid'
                    ? 'text-green'
                    : 'text-subtext0'
                }`}
              />
              <input
                type="text"
                autoFocus
                disabled={isCloning}
                value={remoteUrl}
                onChange={handleUrlChange}
                placeholder="https://github.com/owner/repository.git or git@github.com:owner/repo.git"
                className={`w-full pl-9 pr-9 py-2 bg-surface0 border text-xs placeholder-subtext0 font-mono outline-hidden transition-all disabled:opacity-60 ${
                  urlStatus === 'invalid'
                    ? 'border-red text-red focus:border-red focus:ring-1 focus:ring-red'
                    : urlStatus === 'valid'
                    ? 'border-green text-text focus:border-green focus:ring-1 focus:ring-green'
                    : 'border-surface1 text-text focus:border-blue focus:ring-1 focus:ring-blue'
                }`}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                {urlStatus === 'validating' && (
                  <Loader2 className="w-4 h-4 text-blue animate-spin" />
                )}
                {urlStatus === 'valid' && (
                  <Check className="w-4 h-4 text-green" />
                )}
                {urlStatus === 'invalid' && (
                  <AlertCircle className="w-4 h-4 text-red" />
                )}
              </div>
            </div>

            {/* Validation Message Below Input */}
            {urlStatus === 'invalid' && (
              <p className="text-[11px] text-red mt-1.5 flex items-start gap-1.5 animate-in fade-in duration-150">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red" />
                <span className="leading-tight font-mono">{urlMessage}</span>
              </p>
            )}
            {urlStatus === 'valid' && (
              <p className="text-[11px] text-green mt-1.5 flex items-center gap-1.5 animate-in fade-in duration-150">
                <Check className="w-3.5 h-3.5 shrink-0 text-green" />
                <span className="leading-tight">{urlMessage}</span>
              </p>
            )}
            {urlStatus === 'validating' && (
              <p className="text-[11px] text-subtext0 mt-1.5 flex items-center gap-1.5 animate-in fade-in duration-150">
                <Loader2 className="w-3 h-3 shrink-0 animate-spin text-blue" />
                <span className="leading-tight">{urlMessage}</span>
              </p>
            )}
            {urlStatus === 'idle' && (
              <p className="text-[10px] text-subtext0 mt-1">
                Supports HTTPS and SSH URLs from GitHub, GitLab, Bitbucket, or self-hosted Git
              </p>
            )}
          </div>

          {/* Local Destination Folder */}
          <div>
            <label className="block text-xs font-medium text-text mb-1.5">
              Destination Directory <span className="text-red">*</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Folder className="w-4 h-4 text-subtext0 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  disabled={isCloning}
                  value={parentDir}
                  onChange={(e) => setParentDir(e.target.value)}
                  placeholder="Select parent folder on disk..."
                  className="w-full pl-9 pr-3 py-2 bg-surface0 border border-surface1 focus:border-blue focus:ring-1 focus:ring-blue text-xs text-text placeholder-subtext0 font-mono outline-hidden transition-all disabled:opacity-60"
                />
              </div>
              <button
                type="button"
                disabled={isCloning}
                onClick={handleBrowseFolder}
                className="px-3.5 py-2 bg-surface1 hover:bg-surface2 text-text border border-surface2 text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
              >
                <FolderOpen className="w-3.5 h-3.5 text-blue" />
                <span>Browse...</span>
              </button>
            </div>
          </div>

          {/* Repository Folder Name */}
          <div>
            <label className="block text-xs font-medium text-text mb-1.5">
              Target Folder Name
            </label>
            <input
              type="text"
              disabled={isCloning}
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              placeholder="e.g. my-project"
              className="w-full px-3 py-2 bg-surface0 border border-surface1 focus:border-blue focus:ring-1 focus:ring-blue text-xs text-text placeholder-subtext0 font-mono outline-hidden transition-all disabled:opacity-60"
            />
          </div>

          {/* Resolved Path Preview */}
          {destinationPath && (
            <div className="bg-surface0/60 border border-surface1/60 p-3 text-[11px]">
              <span className="text-subtext0 block mb-0.5">Cloning into:</span>
              <code className="text-blue font-mono font-medium break-all select-all">
                {destinationPath}
              </code>
            </div>
          )}

          {/* Command Preview Box */}
          <div className="bg-surface0/40 border border-surface1/40 p-2.5 flex items-center gap-2 text-[11px] text-subtext0 font-mono overflow-x-auto">
            <Terminal className="w-3.5 h-3.5 text-peach shrink-0" />
            <span className="truncate">
              git clone --progress {remoteUrl.trim() || '&lt;url&gt;'}{' '}
              {destinationPath.trim() || '&lt;destination&gt;'}
            </span>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 border-t border-surface0 flex items-center justify-between">
            <div className="text-[11px] text-subtext0">
              {isCloning && (
                <span className="flex items-center gap-1.5 text-blue">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Cloning repository, please wait...
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                disabled={isCloning}
                onClick={handleClose}
                className="px-3.5 py-1.5 bg-surface1 hover:bg-surface2 text-subtext1 hover:text-text text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  isCloning ||
                  urlStatus === 'validating' ||
                  urlStatus === 'invalid' ||
                  !remoteUrl.trim() ||
                  !destinationPath.trim()
                }
                className="flex items-center gap-2 px-4 py-1.5 bg-brand hover:bg-brand/90 text-[#11111b] font-semibold text-xs shadow-md shadow-brand/20 border border-brand transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              >
                {isCloning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Cloning...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Clone Repository</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
