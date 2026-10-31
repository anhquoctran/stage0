import { useTranslation as useUiTextTranslation } from 'react-i18next';
import { useApplicationServices } from '../../../core/services/runtime/useApplicationServices';
import React, { useEffect, useState } from 'react';

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
  const { t: translateUiText } = useUiTextTranslation();
  const appServices = useApplicationServices();
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
    name: '',
    email: '',
  });
  const [isIdentityLoaded, setIsIdentityLoaded] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isRepoOverviewOpen || !currentRepo) return;
    let cancelled = false;

    appServices.gitHistory.getGitUserIdentityCmd({
      repoPath: currentRepo.local_path,
    })
      .then(([name, email]) => {
        if (!cancelled) {
          setUserIdentity({
            name: name || '',
            email: email || '',
          });
          setIsIdentityLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUserIdentity({ name: '', email: '' });
          setIsIdentityLoaded(true);
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
    showToast(translateUiText('git.repoOverview.copiedToClipboard', { label }));
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 2000);
  };

  const handleOpenInVsCode = async () => {
    try {
      await openRepoInVsCode(currentRepo.local_path);
      showToast(translateUiText('git.repoOverview.openedInVsCode'), 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, 'error');
    }
  };

  const handleOpenInTerminal = async () => {
    try {
      await openRepoInTerminal(currentRepo.local_path);
      showToast(translateUiText('git.repoOverview.openedInTerminal'), 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(translateUiText('git.repoOverview.openTerminalFailed', { error: msg }), 'error');
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
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-surface0 bg-crust rounded-t-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <Info className="w-5 h-5 text-primary shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-text truncate">{translateUiText('git.repoOverview.title')}</h2>
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
            title={translateUiText('shortcuts.close')}
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
              <span>{translateUiText('git.repoOverview.generalInformation')}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-subtext0 text-[11px] block">{translateUiText('git.repoOverview.localPath')}</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="font-mono text-text truncate max-w-[200px]" title={currentRepo.local_path}>
                    {currentRepo.local_path}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(currentRepo.local_path, 'path', translateUiText('git.repoOverview.localPath'))}
                    className="p-1 hover:bg-surface0 text-subtext0 hover:text-text rounded-sm cursor-pointer"
                    title={translateUiText('menu.commands.copy_abs_path')}
                  >
                    {copiedKey === 'path' ? <Check className="w-3 h-3 text-green" /> : <Copy className="w-3 h-3" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => void revealInOs(currentRepo.local_path, '')}
                    className="p-1 hover:bg-surface0 text-subtext0 hover:text-text rounded-sm cursor-pointer"
                    title={translateUiText('git.repoOverview.revealIn', { name: fileManagerName })}
                  >
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div>
                <span className="text-subtext0 text-[11px] block">{translateUiText('git.repoOverview.remoteOrigin')}</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="font-mono text-text truncate max-w-[200px]" title={remoteUrl || translateUiText('git.blame.noRemoteUrl')}>
                    {remoteUrl || translateUiText('git.repoOverview.noRemoteUrl')}
                  </span>
                  {remoteUrl && (
                    <button
                      type="button"
                      onClick={() => handleCopy(remoteUrl, 'remote', translateUiText('menu.commands.copy_remote_url'))}
                      className="p-1 hover:bg-surface0 text-subtext0 hover:text-text rounded-sm cursor-pointer"
                      title={translateUiText('menu.commands.copy_remote_url')}
                    >
                      {copiedKey === 'remote' ? <Check className="w-3 h-3 text-green" /> : <Copy className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              </div>

              <div>
                <span className="text-subtext0 text-[11px] block">{translateUiText('git.repoOverview.gitIdentity')}</span>
                <div className="flex items-center gap-1.5 mt-0.5 font-medium text-text">
                  <User className="w-3.5 h-3.5 text-subtext0 shrink-0" />
                  <span className="truncate">
                    {userIdentity.name || translateUiText(isIdentityLoaded ? 'git.repoOverview.localGitUser' : 'common.loading')}
                  </span>
                  <span className="text-subtext0 text-[11px] font-mono truncate">
                    {'<'}{userIdentity.email || translateUiText('git.repoOverview.notConfigured')}{'>'}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-subtext0 text-[11px] block">{translateUiText('git.repoOverview.defaultBaseBranch')}</span>
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
                <span>{translateUiText('git.repoOverview.branches')}</span>
              </div>
              <div className="mt-1 text-lg font-bold text-text">
                {localBranchCount + remoteBranchCount}
              </div>
              <div className="text-[10px] text-subtext0 mt-0.5 font-mono">
                {translateUiText('git.repoOverview.localRemoteCounts', { local: localBranchCount, remote: remoteBranchCount })}
              </div>
            </div>

            <div className="p-3 bg-crust border border-surface0/80 text-center rounded-sm">
              <div className="flex items-center justify-center gap-1 text-primary text-xs font-semibold">
                <Tag className="w-3.5 h-3.5" />
                <span>{translateUiText('git.repoOverview.tags')}</span>
              </div>
              <div className="mt-1 text-lg font-bold text-text">{tags.length}</div>
              <div className="text-[10px] text-subtext0 mt-0.5">{translateUiText('git.repoOverview.releaseCheckpoints')}</div>
            </div>

            <div className="p-3 bg-crust border border-surface0/80 text-center rounded-sm">
              <div className="flex items-center justify-center gap-1 text-primary text-xs font-semibold">
                <Globe className="w-3.5 h-3.5" />
                <span>{translateUiText('git.repoOverview.remotes')}</span>
              </div>
              <div className="mt-1 text-lg font-bold text-text">{remotes.length}</div>
              <div className="text-[10px] text-subtext0 mt-0.5 truncate font-mono">
                {remotes.join(', ') || translateUiText('git.repoOverview.none')}
              </div>
            </div>

            <div className="p-3 bg-crust border border-surface0/80 text-center rounded-sm">
              <div className="flex items-center justify-center gap-1 text-primary text-xs font-semibold">
                <FileCode className="w-3.5 h-3.5" />
                <span>{translateUiText('git.repoOverview.workingDiff')}</span>
              </div>
              <div className="mt-1 text-lg font-bold text-text">
                {translateUiText('git.repoOverview.filesCount', { count: diffPayload?.files.length ?? 0 })}
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
                <span>{translateUiText('git.repoOverview.virtualMergeRequests', { count: sessions.length })}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="px-2 py-0.5 bg-green-600 text-white font-semibold rounded-sm">
                  {openMrCount} {translateUiText('common.tabs.open')}
                </span>
                <span className="px-2 py-0.5 bg-blue-600 text-white font-semibold rounded-sm">
                  {resolvedMrCount} {translateUiText('common.tabs.resolved')}
                </span>
                <span className="px-2 py-0.5 bg-gray-600 text-white font-semibold rounded-sm">
                  {closedMrCount} {translateUiText('common.tabs.closed')}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-surface0/50 text-[11px] text-subtext0">
              <div className="flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span>{translateUiText('git.repoOverview.aiReviewBots')}</span>
                <span className="font-semibold text-text">
                  {translateUiText('git.repoOverview.activeBots', { count: repoSettings?.activeAgentIds?.length || 0 })}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>{translateUiText('git.repoOverview.repositoryLabels')}</span>
                <span className="font-semibold text-text">
                  {translateUiText('git.repoOverview.labelsConfigured', { count: repoLabels.length })}
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
              title={translateUiText('menu.commands.open_vscode')}
            >
              <VsCode className="w-3.5 h-3.5 text-[#007acc] shrink-0" />
              <span>{translateUiText('menu.commands.open_vscode')}</span>
            </button>

            <button
              type="button"
              onClick={() => void handleOpenInTerminal()}
              className="px-2.5 py-1.5 bg-surface0 hover:bg-surface1 text-text flex items-center gap-1.5 transition-colors cursor-pointer rounded-sm"
              title={translateUiText('menu.commands.open_terminal')}
            >
              <Terminal className="w-3.5 h-3.5 text-primary" />
              <span>{translateUiText('menu.commands.open_terminal')}</span>
            </button>

            <button
              type="button"
              onClick={() => void openRepoInExplorer(currentRepo.local_path)}
              className="px-2.5 py-1.5 bg-surface0 hover:bg-surface1 text-text flex items-center gap-1.5 transition-colors cursor-pointer rounded-sm"
              title={translateUiText('git.repoOverview.openIn', { name: fileManagerName })}
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
              <span>{translateUiText('menu.commands.repo_settings')}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsRepoOverviewOpen(false)}
              className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-on-accent font-medium transition-colors cursor-pointer rounded-sm"
            >
              {translateUiText('common.close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

