import { RepositorySettingsJsonEditor } from './repository-settings/RepositorySettingsJsonEditor';
import { useRepositorySettingsDraft } from './repository-settings/useRepositorySettingsDraft';
import { hasLegacyRepoReviewers, importLegacyRepoReviewers } from '../../ai/services/importLegacyRepoReviewers';
import { useTranslation as useUiTextTranslation } from 'react-i18next';
import React, { useState, useEffect } from 'react';
import { X } from '../../../common/components/icons/X';
import { Globe } from '../../../common/components/icons/Globe';
import { GitBranch } from '../../../common/components/icons/GitBranch';
import { Tag } from '../../../common/components/icons/Tag';
import { Bot } from '../../../common/components/icons/Bot';
import { FolderCog } from '../../../common/components/icons/FolderCog';
import { useVirtualMrStore } from '../../virtual-mr/store/useVirtualMrStore';
import { useGitStore } from '../store/useGitStore';
import type { RepositorySettingsModalProps } from '../types/RepositorySettingsModalProps';
import { RepositoryRemotesTab } from './repository-settings/RepositoryRemotesTab';
import { RepositoryBranchesTab } from './repository-settings/RepositoryBranchesTab';
import { RepositoryLabelsTab } from './repository-settings/RepositoryLabelsTab';
import { RepositoryAgentsTab } from './repository-settings/RepositoryAgentsTab';

export const RepositorySettingsModal: React.FC<RepositorySettingsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'remotes',
}) => {
  const { t: translateUiText } = useUiTextTranslation();
  const { currentRepo, showToast } = useGitStore();
  const { repoSettings, saveRepoSettings } = useVirtualMrStore();

  const [activeTab, setActiveTab] = useState<'remotes' | 'branches' | 'labels' | 'agents'>(
    initialTab
  );

  const { customRules, setCustomRules, inheritAgents, setInheritAgents,
    defaultBaseBranch, setDefaultBaseBranch, baselineRevision, conflict, resetDraft } =
    useRepositorySettingsDraft(isOpen, currentRepo?.id, repoSettings);
  const [saving, setSaving] = useState(false);
  const [isJsonEditorOpen, setIsJsonEditorOpen] = useState(false);
  useEffect(() => { if (!isOpen) setIsJsonEditorOpen(false); }, [isOpen]);
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  useEffect(() => {
    if (isOpen && currentRepo) void useVirtualMrStore.getState().refreshRepoMetadata(currentRepo.id)
      .catch((error) => showToast(String(error), 'error'));
  }, [isOpen, currentRepo?.id, showToast]);

  if (!isOpen || !currentRepo) return null;

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await saveRepoSettings({
        revision: baselineRevision,
        defaultBaseBranch,
        inheritGlobalAgents: inheritAgents,
        customAgentRules: customRules,
      });
      showToast(translateUiText('git.repoSettingsModal.saved'));
      onClose();
    } catch (err: any) {
      showToast(translateUiText('git.repoSettingsModal.saveFailed', { error: String(err) }), 'error');
    } finally { setSaving(false); }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      onClick={() => { if (!isJsonEditorOpen) onClose(); }}
    >
      <div
        className="w-full max-w-4xl h-[720px] max-h-[calc(100dvh-2rem)] bg-base border border-surface0 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 rounded-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="shrink-0 px-6 py-4 border-b border-surface0 flex items-center justify-between bg-crust rounded-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-surface0 text-text rounded-sm">
              <FolderCog className="w-5 h-5 text-brand" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-text">
                  {translateUiText('git.repoSettingsModal.title')}
                </h2>
                <span className="text-[11px] font-mono px-2 py-0.5 bg-surface0 text-subtext0">
                  {currentRepo.name}
                </span>
              </div>
              <p className="text-xs text-subtext0 truncate max-w-lg mt-0.5 font-mono">
                {currentRepo.local_path}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-subtext0 hover:text-text hover:bg-surface0 transition-colors cursor-pointer rounded-sm"
            aria-label={translateUiText('git.repoSettingsModal.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* BODY (SIDEBAR + CONTENT) */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* TABS SIDEBAR */}
          <div className="w-52 min-h-0 overflow-y-auto border-e border-surface0 bg-crust p-3 flex flex-col justify-between shrink-0 rounded-sm">
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setActiveTab('remotes')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-start transition-colors cursor-pointer rounded-sm ${
                  activeTab === 'remotes'
                    ? 'bg-surface0 text-text font-medium border-s-2 border-brand'
                    : 'text-subtext0 hover:bg-surface0/50 hover:text-text'
                }`}
              >
                <Globe className="w-4 h-4 shrink-0 text-subtext0" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs leading-tight font-medium">{translateUiText('git.repoSettingsModal.remotes')}</div>
                  <div className="text-[10px] text-subtext0 truncate mt-0.5">
                    {translateUiText('git.repoSettingsModal.remoteDescription')}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('branches')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-start transition-colors cursor-pointer rounded-sm ${
                  activeTab === 'branches'
                    ? 'bg-surface0 text-text font-medium border-s-2 border-brand'
                    : 'text-subtext0 hover:bg-surface0/50 hover:text-text'
                }`}
              >
                <GitBranch className="w-4 h-4 shrink-0 text-subtext0" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs leading-tight font-medium">{translateUiText('git.repoSettingsModal.branchesAndTags')}</div>
                  <div className="text-[10px] text-subtext0 truncate mt-0.5">
                    {translateUiText('git.repoSettingsModal.branchesDescription')}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('labels')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-start transition-colors cursor-pointer rounded-sm ${
                  activeTab === 'labels'
                    ? 'bg-surface0 text-text font-medium border-s-2 border-brand'
                    : 'text-subtext0 hover:bg-surface0/50 hover:text-text'
                }`}
              >
                <Tag className="w-4 h-4 shrink-0 text-subtext0" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs leading-tight font-medium">{translateUiText('git.repoSettingsModal.labels')}</div>
                  <div className="text-[10px] text-subtext0 truncate mt-0.5">
                    {translateUiText('git.repoSettingsModal.labelsDescription')}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('agents')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-start transition-colors cursor-pointer rounded-sm ${
                  activeTab === 'agents'
                    ? 'bg-surface0 text-text font-medium border-s-2 border-brand'
                    : 'text-subtext0 hover:bg-surface0/50 hover:text-text'
                }`}
              >
                <Bot className="w-4 h-4 shrink-0 text-subtext0" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs leading-tight font-medium">{translateUiText('git.repoSettingsModal.aiReviewers')}</div>
                  <div className="text-[10px] text-subtext0 truncate mt-0.5">
                    {translateUiText('git.repoSettingsModal.reviewersDescription')}
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* CONTENT AREA */}
          <div className="flex-1 min-w-0 min-h-0 p-6 overflow-y-auto bg-mantle rounded-sm">
            <div className="mb-4 space-y-2">
              <p className="text-xs text-subtext0 font-mono">.stage0/repos.jsonc</p>
              {(repoSettings?.validationError || conflict) && <div role="alert" className="rounded-sm bg-red-600 text-white px-3 py-2 text-xs">
                {repoSettings?.validationError || translateUiText('git.repoSettingsModal.fileConflict')}
                <button type="button" className="ms-3 rounded-sm border-0 bg-white text-black px-2 py-1"
                  onClick={async () => {
                    try {
                      await useVirtualMrStore.getState().refreshRepoMetadata(currentRepo.id);
                      const next = useVirtualMrStore.getState().repoSettings;
                      if (next) resetDraft(next);
                    } catch (error) { showToast(String(error), 'error'); }
                  }}>{translateUiText('common.layout.refresh')}</button>
              </div>}
              {hasLegacyRepoReviewers(currentRepo.id) && <button type="button"
                className="rounded-sm border-0 bg-surface0 px-3 py-1.5 text-xs text-text"
                onClick={() => { void importLegacyRepoReviewers(currentRepo.id)
                  .then(() => showToast(translateUiText('git.repoSettingsModal.saved')))
                  .catch((error) => showToast(String(error), 'error')); }}>
                {translateUiText('git.repoSettingsModal.importLegacyReviewers')}
              </button>}
            </div>
            {activeTab === 'remotes' && <RepositoryRemotesTab />}
            {activeTab === 'branches' && (
              <RepositoryBranchesTab
                defaultBaseBranch={defaultBaseBranch}
                setDefaultBaseBranch={setDefaultBaseBranch}
              />
            )}
            {activeTab === 'labels' && <RepositoryLabelsTab />}
            {activeTab === 'agents' && (
              <RepositoryAgentsTab
                inheritAgents={inheritAgents}
                setInheritAgents={setInheritAgents}
                customRules={customRules}
                setCustomRules={setCustomRules}
                onClose={onClose}
              />
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="shrink-0 px-6 py-3.5 border-t border-surface0 flex items-center justify-between gap-3 bg-base/60 rounded-sm">
          <button type="button" onClick={() => setIsJsonEditorOpen(true)} disabled={saving}
            className="shrink-0 rounded-sm border border-surface1 bg-base px-3 py-1.5 text-xs text-subtext1 hover:text-text">
            {translateUiText('git.repoSettingsModal.editFile')}
          </button>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-surface0 hover:bg-surface1 text-text text-xs transition-colors cursor-pointer border border-surface1 rounded-sm"
            >
              {translateUiText('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={saving || conflict || !baselineRevision || !!repoSettings?.validationError}
              className="px-5 py-1.5 bg-brand hover:bg-brand/90 text-on-accent font-semibold text-xs transition-colors cursor-pointer shadow-md shadow-brand/20 border border-brand rounded-sm"
            >
              {translateUiText('git.repoSettingsModal.save')}
            </button>
          </div>
        </div>
        {isJsonEditorOpen && <RepositorySettingsJsonEditor key={currentRepo.id} repoId={currentRepo.id} repoPath={currentRepo.local_path}
          onClose={() => setIsJsonEditorOpen(false)} />}
      </div>
    </div>
  );
};
