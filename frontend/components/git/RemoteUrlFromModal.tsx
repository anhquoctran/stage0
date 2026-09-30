import React, { useState, useMemo } from 'react';
import {
  Globe,
  X,
  Copy,
  Check,
  ExternalLink,
  GitBranch,
  GitCommit,
} from '@/components/common/icons';
import { useGitStore } from '../../store/useGitStore';
import { buildRemoteFileUrl } from '../../utils/fileActions';

export const RemoteUrlFromModal: React.FC = () => {
  const {
    isRemoteUrlFromOpen,
    setIsRemoteUrlFromOpen,
    targetFileForUrl,
    selectedFile,
    currentRepo,
    remoteUrl,
    baseBranch,
    compareBranch,
    diffPayload,
    showToast,
  } = useGitStore();

  const file = targetFileForUrl || selectedFile;
  const [customRef, setCustomRef] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const effectiveRemoteUrl = remoteUrl || (currentRepo ? `https://github.com/${currentRepo.name}` : '');

  const targets = useMemo(() => {
    if (!file || !effectiveRemoteUrl) return [];

    const list: Array<{
      key: string;
      label: string;
      sublabel: string;
      ref: string;
      badge: string;
      icon: React.ReactNode;
      url: string;
    }> = [];

    if (compareBranch) {
      list.push({
        key: 'compare_branch',
        label: 'Compare Branch (MR Source)',
        sublabel: compareBranch,
        ref: compareBranch,
        badge: 'Compare',
        icon: <GitBranch className="w-3.5 h-3.5 text-subtext0" />,
        url: buildRemoteFileUrl(effectiveRemoteUrl, compareBranch, file.path),
      });
    }

    if (baseBranch) {
      list.push({
        key: 'base_branch',
        label: 'Base Branch (MR Target)',
        sublabel: baseBranch,
        ref: baseBranch,
        badge: 'Base',
        icon: <GitBranch className="w-3.5 h-3.5 text-subtext0" />,
        url: buildRemoteFileUrl(effectiveRemoteUrl, baseBranch, file.path),
      });
    }

    if (diffPayload?.compare_commit) {
      list.push({
        key: 'compare_commit',
        label: 'Compare Commit',
        sublabel: diffPayload.compare_commit.substring(0, 7),
        ref: diffPayload.compare_commit,
        badge: 'Commit',
        icon: <GitCommit className="w-3.5 h-3.5 text-subtext0" />,
        url: buildRemoteFileUrl(effectiveRemoteUrl, diffPayload.compare_commit, file.path),
      });
    }

    if (diffPayload?.base_commit) {
      list.push({
        key: 'base_commit',
        label: 'Base Commit',
        sublabel: diffPayload.base_commit.substring(0, 7),
        ref: diffPayload.base_commit,
        badge: 'Commit',
        icon: <GitCommit className="w-3.5 h-3.5 text-subtext0" />,
        url: buildRemoteFileUrl(effectiveRemoteUrl, diffPayload.base_commit, file.path),
      });
    }

    return list;
  }, [file, effectiveRemoteUrl, compareBranch, baseBranch, diffPayload]);

  const customUrl = useMemo(() => {
    if (!file || !effectiveRemoteUrl || !customRef.trim()) return '';
    return buildRemoteFileUrl(effectiveRemoteUrl, customRef.trim(), file.path);
  }, [file, effectiveRemoteUrl, customRef]);

  if (!isRemoteUrlFromOpen) return null;

  const handleCopy = (url: string, key: string) => {
    navigator.clipboard.writeText(url);
    setCopiedKey(key);
    showToast(`Copied remote URL (${key}) to clipboard!`);
    setTimeout(() => {
      setCopiedKey(null);
      setIsRemoteUrlFromOpen(false);
    }, 800);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 top-8.5 z-50 bg-crust/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-mantle border border-surface0 w-full max-w-xl shadow-2xl animate-in zoom-in-95 duration-150 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div
          data-tauri-drag-region
          className="flex items-center justify-between px-4 py-3 border-b border-surface0 bg-base cursor-default"
        >
          <div data-tauri-drag-region className="flex items-center gap-2 pointer-events-none">
            <Globe className="w-4 h-4 text-subtext0" />
            <h3 className="text-sm font-bold text-text">Copy Remote File URL from...</h3>
          </div>
          <button
            type="button"
            onClick={() => setIsRemoteUrlFromOpen(false)}
            className="p-1 rounded text-subtext0 hover:text-text hover:bg-surface0 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto">
          {/* File path banner */}
          <div className="bg-surface0/60 border border-surface0 px-3 py-2 flex items-center justify-between gap-2 font-mono text-xs">
            <div className="min-w-0 truncate">
              <span className="text-subtext0 text-[10px] block uppercase font-sans font-bold">Target File</span>
              <span className="text-text font-semibold truncate block">{file ? file.path : 'No file selected'}</span>
            </div>
            {effectiveRemoteUrl && (
              <span className="text-[10px] text-subtext1 truncate max-w-[200px]" title={effectiveRemoteUrl}>
                {effectiveRemoteUrl}
              </span>
            )}
          </div>

          {!file ? (
            <div className="py-6 text-center text-xs text-subtext0">
              Please select a file to copy its remote URL.
            </div>
          ) : (
            <div className="space-y-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-subtext1 block">
                Select Branch or Commit Reference
              </span>

              <div className="space-y-2">
                {targets.map((item) => {
                  const isCopied = copiedKey === item.key;
                  return (
                    <div
                      key={item.key}
                      className="border border-surface0 bg-surface0/30 hover:bg-surface0/80 transition-colors p-2.5 flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <div className="mt-0.5 shrink-0">{item.icon}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-text">{item.label}</span>
                            <span className="text-[10px] px-1.5 py-0.2 bg-surface1 text-subtext1 font-mono">
                              {item.badge}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-subtext0 truncate block mt-0.5">
                            {item.url}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopy(item.url, item.key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors shrink-0 cursor-pointer ${
                          isCopied
                            ? 'bg-surface2 text-text font-bold'
                            : 'bg-surface1 hover:bg-surface2 text-text'
                        }`}
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-subtext1" />
                            <span>Copy URL</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Custom Ref Option */}
              <div className="pt-2 border-t border-surface0/70">
                <span className="text-[10px] font-bold uppercase tracking-wider text-subtext1 block mb-1.5">
                  Or Custom Branch / Tag / SHA
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customRef}
                    onChange={(e) => setCustomRef(e.target.value)}
                    placeholder="e.g. develop, v1.2.0, or commit hash..."
                    className="flex-1 px-3 py-1.5 bg-base border border-surface0 text-xs text-text placeholder-subtext0 focus:outline-hidden focus:border-surface2 font-mono"
                  />
                  <button
                    type="button"
                    disabled={!customUrl}
                    onClick={() => handleCopy(customUrl, 'custom')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-surface1 hover:bg-surface2 text-text border border-surface2 rounded transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Copy Custom URL</span>
                  </button>
                </div>
                {customUrl && (
                  <span className="text-[10px] font-mono text-subtext1 truncate block mt-1 px-1">
                    {customUrl}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-4 py-2.5 border-t border-surface0 bg-base">
          <button
            type="button"
            onClick={() => setIsRemoteUrlFromOpen(false)}
            className="px-4 py-1.5 bg-surface1 hover:bg-surface2 text-text font-medium text-xs rounded transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
