import React, { useEffect, useState } from 'react';
import { invoke } from '../../../common/services/ipc/ipcClient';
import { Bot } from '../../../common/components/icons/Bot';
import { Check } from '../../../common/components/icons/Check';
import { Copy } from '../../../common/components/icons/Copy';
import { ExternalLink } from '../../../common/components/icons/ExternalLink';
import { FileCode } from '../../../common/components/icons/FileCode';
import { Cog } from '../../../common/components/icons/Cog';
import { FolderGit2 } from '../../../common/components/icons/FolderGit2';
import { GitBranch } from '../../../common/components/icons/GitBranch';
import { GitPullRequest } from '../../../common/components/icons/GitPullRequest';
import { Globe } from '../../../common/components/icons/Globe';
import { Info } from '../../../common/components/icons/Info';
import { Tag } from '../../../common/components/icons/Tag';
import { Terminal } from '../../../common/components/icons/Terminal';
import { User } from '../../../common/components/icons/User';
import { VsCode } from '../../../common/components/icons/VsCode';
import { X } from '../../../common/components/icons/X';
import { useVirtualMrStore } from '../../virtual-mr/store/useVirtualMrStore';
import { useGitStore } from '../store/useGitStore';
import {
  getOsFileManagerName,
  openRepoInExplorer,
  openRepoInTerminal,
  openRepoInVsCode,
  revealInOs,
} from '../utils/fileActions';

export const RepositoryOverviewModal: React.FC = () => {
  const {
    currentRepo,
    isRepoOverviewOpen,
    setIsRepoOverviewOpen,
    branches,
    remoteUrl,
    remotes,
    compareBranch,
    baseBranch,
    diffPayload,
    showToast,
  } = useGitStore();

  const {
    sessions,
    repoSettings,
    repoLabels,
    tags,
    openRepoSettings,
  } = useVirtualMrStore();

  const [userIdentity, setUserIdentity] = useState<{ name: string; email: string }>({
    name: 'Loading…',
    email: '',
  });
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isRepoOverviewOpen || !currentRepo) return;
    let cancelled = false;

    invoke<[string, string]>('get_git_user_identity_cmd', {
      repoPath: currentRepo.local_path,
    })
      .then(([name, email]) => {
        if (!cancelled) {
          setUserIdentity({
            name: name || 'Local Git User',
            email: email || 'Not configured',
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUserIdentity({ name: 'Local Git User', email: '' });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isRepoOverviewOpen, currentRepo]);

  useEffect(() => {
    if (!isRepoOverviewOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsRepoOverviewOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRepoOverviewOpen, setIsRepoOverviewOpen]);

  if (!isRepoOverviewOpen || !currentRepo) return null;

  const handleCopy = (text: string, key: string, label: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast(`Copied ${label} to clipboard`);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 2000);
  };

  const handleOpenInVsCode = async () => {
    try {
      await openRepoInVsCode(currentRepo.local_path);
      showToast('Opened repository in VS Code', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, 'error');
    }
  };

  const handleOpenInTerminal = async () => {
    try {
      await openRepoInTerminal(currentRepo.local_path);
      showToast('Opened repository in terminal', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Failed to open terminal: ${msg}`, 'error');
    }
  };

  const fileManagerName = getOsFileManagerName();
  const openMrCount = sessions.filter((s) => s.status === 'open').length;
  const resolvedMrCount = sessions.filter((s) => s.status === 'resolved').length;
  const closedMrCount = sessions.filter((s) => s.status === 'closed').length;
  const localBranchCount = branches?.local?.length || 0;
  const remoteBranchCount = branches?.remote?.length || 0;
  const checkedOutBranch = branches?.current || compareBranch || 'HEAD';
  const defaultBaseBranch = repoSettings?.defaultBaseBranch || baseBranch || 'main';

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-x-0 bottom-0 top-8.5 z-50 flex items-center justify-center bg-crust/80 backdrop-blur-xs p-4 select-none animate-in fade-in duration-150 rounded-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setIsRepoOverviewOpen(false);
      }}
    >
      <div className="w-full max-w-2xl bg-mantle border border-surface0 shadow-2xl overflow-hidden flex flex-col max-h-full rounded-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-surface0 bg-crust">
          <div className="flex items-center gap-2.5 min-w-0">
            <Info className="w-5 h-5 text-primary shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-text truncate">Repository Overview</h2>
                <span className="px-1.5 py-0.5 rounded-sm bg-surface0 text-[10px] font-mono text-subtext0">
                  {currentRepo.name}
                </span>
              </div>
              <p className="text-[11px] text-subtext0 truncate mt-0.5" title={currentRepo.local_path}>
                {currentRepo.local_path}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsRepoOverviewOpen(false)}
            className="p-1.5 hover:bg-surface0 rounded-sm text-subtext0 hover:text-text transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs select-text">
          {/* General Information Card */}
          <div className="p-3.5 bg-crust border border-surface0/80 space-y-2.5 rounded-sm">
            <div className="text-[11px] font-semibold text-subtext0 uppercase tracking-wider flex items-center gap-1.5">
              <FolderGit2 className="w-3.5 h-3.5 text-primary" />
              <span>General Information</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-subtext0 text-[11px] block">Local Path:</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="font-mono text-text truncate max-w-[200px]" title={currentRepo.local_path}>
                    {currentRepo.local_path}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(currentRepo.local_path, 'path', 'local path')}
                    className="p-1 hover:bg-surface0 text-subtext0 hover:text-text rounded-sm cursor-pointer"
                    title="Copy local path"
                  >
                    {copiedKey === 'path' ? <Check className="w-3 h-3 text-green" /> : <Copy className="w-3 h-3" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => void revealInOs(currentRepo.local_path, '')}
                    className="p-1 hover:bg-surface0 text-subtext0 hover:text-text rounded-sm cursor-pointer"
                    title={`Reveal in ${fileManagerName}`}
                  >
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div>
                <span className="text-subtext0 text-[11px] block">Remote Origin:</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="font-mono text-text truncate max-w-[200px]" title={remoteUrl || 'No remote URL configured'}>
                    {remoteUrl || 'No remote URL'}
                  </span>
                  {remoteUrl && (
                    <button
                      type="button"
                      onClick={() => handleCopy(remoteUrl, 'remote', 'remote URL')}
                      className="p-1 hover:bg-surface0 text-subtext0 hover:text-text rounded-sm cursor-pointer"
                      title="Copy remote URL"
                    >
                      {copiedKey === 'remote' ? <Check className="w-3 h-3 text-green" /> : <Copy className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              </div>

              <div>
                <span className="text-subtext0 text-[11px] block">Git Identity:</span>
                <div className="flex items-center gap-1.5 mt-0.5 font-medium text-text">
                  <User className="w-3.5 h-3.5 text-subtext0 shrink-0" />
                  <span className="truncate">{userIdentity.name}</span>
                  {userIdentity.email && (
                    <span className="text-subtext0 text-[11px] font-mono truncate">
                      &lt;{userIdentity.email}&gt;
                    </span>
                  )}
                </div>
              </div>

              <div>
                <span className="text-subtext0 text-[11px] block">Default Base Branch:</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <GitBranch className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="font-mono text-text font-medium">{defaultBaseBranch}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Git Statistics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 bg-crust border border-surface0/80 text-center rounded-sm">
              <div className="flex items-center justify-center gap-1 text-primary text-xs font-semibold">
                <GitBranch className="w-3.5 h-3.5" />
                <span>Branches</span>
              </div>
              <div className="mt-1 text-lg font-bold text-text">
                {localBranchCount + remoteBranchCount}
              </div>
              <div className="text-[10px] text-subtext0 mt-0.5 font-mono">
                {localBranchCount} local · {remoteBranchCount} remote
              </div>
            </div>

            <div className="p-3 bg-crust border border-surface0/80 text-center rounded-sm">
              <div className="flex items-center justify-center gap-1 text-primary text-xs font-semibold">
                <Tag className="w-3.5 h-3.5" />
                <span>Tags</span>
              </div>
              <div className="mt-1 text-lg font-bold text-text">{tags.length}</div>
              <div className="text-[10px] text-subtext0 mt-0.5">Release checkpoints</div>
            </div>

            <div className="p-3 bg-crust border border-surface0/80 text-center rounded-sm">
              <div className="flex items-center justify-center gap-1 text-primary text-xs font-semibold">
                <Globe className="w-3.5 h-3.5" />
                <span>Remotes</span>
              </div>
              <div className="mt-1 text-lg font-bold text-text">{remotes.length}</div>
              <div className="text-[10px] text-subtext0 mt-0.5 truncate font-mono">
                {remotes.join(', ') || 'None'}
              </div>
            </div>

            <div className="p-3 bg-crust border border-surface0/80 text-center rounded-sm">
              <div className="flex items-center justify-center gap-1 text-primary text-xs font-semibold">
                <FileCode className="w-3.5 h-3.5" />
                <span>Working Diff</span>
              </div>
              <div className="mt-1 text-lg font-bold text-text">
                {diffPayload ? `${diffPayload.files.length} files` : '0 files'}
              </div>
              <div className="text-[10px] text-subtext0 mt-0.5 truncate font-mono">
                {checkedOutBranch}
              </div>
            </div>
          </div>

          {/* Virtual Merge Requests Summary */}
          <div className="p-3.5 bg-crust border border-surface0/80 space-y-2.5 rounded-sm">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold text-subtext0 uppercase tracking-wider flex items-center gap-1.5">
                <GitPullRequest className="w-3.5 h-3.5 text-primary" />
                <span>Virtual Merge Requests ({sessions.length})</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="px-2 py-0.5 bg-green-600 text-white font-semibold rounded-sm">
                  {openMrCount} Open
                </span>
                <span className="px-2 py-0.5 bg-blue-600 text-white font-semibold rounded-sm">
                  {resolvedMrCount} Resolved
                </span>
                <span className="px-2 py-0.5 bg-gray-600 text-white font-semibold rounded-sm">
                  {closedMrCount} Closed
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-surface0/50 text-[11px] text-subtext0">
              <div className="flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span>AI Review Bots:</span>
                <span className="font-semibold text-text">
                  {repoSettings?.activeAgentIds?.length || 0} active
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>Repository Labels:</span>
                <span className="font-semibold text-text">
                  {repoLabels.length} labels configured
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer with External Actions */}
        <div className="px-5 py-3 border-t border-surface0 bg-crust flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleOpenInVsCode()}
              className="px-2.5 py-1.5 bg-surface0 hover:bg-surface1 text-text flex items-center gap-1.5 transition-colors cursor-pointer rounded-sm"
              title="Open repository in VS Code"
            >
              <VsCode className="w-3.5 h-3.5 text-[#007acc] shrink-0" />
              <span>Open in Visual Studio Code</span>
            </button>

            <button
              type="button"
              onClick={() => void handleOpenInTerminal()}
              className="px-2.5 py-1.5 bg-surface0 hover:bg-surface1 text-text flex items-center gap-1.5 transition-colors cursor-pointer rounded-sm"
              title="Open repository in default terminal"
            >
              <Terminal className="w-3.5 h-3.5 text-primary" />
              <span>Terminal</span>
            </button>

            <button
              type="button"
              onClick={() => void openRepoInExplorer(currentRepo.local_path)}
              className="px-2.5 py-1.5 bg-surface0 hover:bg-surface1 text-text flex items-center gap-1.5 transition-colors cursor-pointer rounded-sm"
              title={`Open in ${fileManagerName}`}
            >
              <FolderGit2 className="w-3.5 h-3.5 text-primary" />
              <span>{fileManagerName}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsRepoOverviewOpen(false);
                openRepoSettings('remotes');
              }}
              className="px-3 py-1.5 bg-surface1 hover:bg-surface2 text-text font-medium flex items-center gap-1.5 transition-colors cursor-pointer rounded-sm"
            >
              <Cog className="w-3.5 h-3.5" />
              <span>Repo Settings</span>
            </button>

            <button
              type="button"
              onClick={() => setIsRepoOverviewOpen(false)}
              className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-on-accent font-medium transition-colors cursor-pointer rounded-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

