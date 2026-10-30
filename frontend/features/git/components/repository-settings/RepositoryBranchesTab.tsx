import { useTranslation as useUiTextTranslation } from 'react-i18next';
import React, { useState } from 'react';
import { GitBranch } from '../../../../common/components/icons/GitBranch';
import { Tag } from '../../../../common/components/icons/Tag';
import { Plus } from '../../../../common/components/icons/Plus';
import { Trash2 } from '../../../../common/components/icons/Trash2';
import { CustomSelect } from '../../../../common/components/CustomSelect';
import type { CustomSelectOption } from '../../../../common/types/CustomSelectOption';
import { useGitStore } from '../../store/useGitStore';
import { useVirtualMrStore } from '../../../virtual-mr/store/useVirtualMrStore';

export const RepositoryBranchesTab: React.FC<{
  defaultBaseBranch: string;
  setDefaultBaseBranch: (branch: string) => void;
}> = ({ defaultBaseBranch, setDefaultBaseBranch }) => {
  const { t: translateUiText } = useUiTextTranslation();
  const { currentRepo, branches, fetchBranches, showToast } = useGitStore();
  const { tags, createTag, deleteTag, createBranch, deleteBranch } = useVirtualMrStore();

  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagMessage, setNewTagMessage] = useState('');

  const [isAddingBranch, setIsAddingBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchBase, setNewBranchBase] = useState('HEAD');

  const baseBranchOptions: CustomSelectOption<string>[] = Array.from(
    new Set([...(branches?.local || []), ...(branches?.remote || [])])
  ).map((branch) => ({ value: branch, label: branch }));

  const newBranchBaseOptions: CustomSelectOption<string>[] = [
    { value: 'HEAD', label: translateUiText('git.repositoryBranches.fromHead') },
    ...(branches?.local || []).map((branch) => ({
      value: branch,
      label: translateUiText('git.repositoryBranches.fromBranch', { branch }),
    })),
  ];

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim() || !currentRepo) return;
    try {
      await createBranch(newBranchName.trim(), newBranchBase === 'HEAD' ? undefined : newBranchBase);
      await fetchBranches(currentRepo.local_path);
      showToast(translateUiText('git.repositoryBranches.branchCreated', { name: newBranchName }));
      setNewBranchName('');
      setIsAddingBranch(false);
    } catch (err: any) {
      showToast(translateUiText('git.repositoryBranches.branchCreateFailed', { error: String(err) }));
    }
  };

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;
    try {
      await createTag(newTagName.trim(), 'HEAD', newTagMessage.trim() || undefined);
      showToast(translateUiText('git.repositoryBranches.tagCreated', { name: newTagName }));
      setNewTagName('');
      setNewTagMessage('');
      setIsAddingTag(false);
    } catch (err: any) {
      showToast(translateUiText('git.repositoryBranches.tagCreateFailed', { error: String(err) }));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[1rem] text-text font-medium">{translateUiText('git.repositoryBranches.title')}</h3>
        <p className="text-xs text-subtext0 mt-0.5">
          {translateUiText('git.repositoryBranches.description')}
        </p>
      </div>

      {/* DEFAULT BASE BRANCH */}
      <div className="p-4 bg-crust border border-surface0 space-y-2 rounded-sm">
        <label className="block text-xs font-medium text-text">{translateUiText('git.repositoryBranches.defaultBase')}</label>
        <p className="text-xs text-subtext0">
          {translateUiText('git.repositoryBranches.defaultBaseDescription')}
        </p>
        <CustomSelect
          value={defaultBaseBranch}
          options={baseBranchOptions}
          onChange={setDefaultBaseBranch}
          className="mt-1 w-64"
          buttonClassName="w-full"
          dropdownWidth="w-full"
          align="left"
          placeholder={translateUiText('git.repositoryBranches.selectBranch')}
          aria-label={translateUiText('git.repositoryBranches.defaultBase')}
        />
      </div>

      {/* BRANCHES MANAGEMENT */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-xs text-text flex items-center gap-1.5">
            <GitBranch className="w-3.5 h-3.5 text-subtext0" />
            <span>{translateUiText('git.repositoryBranches.localBranches', { count: branches?.local.length || 0 })}</span>
          </span>
          <button
            onClick={() => setIsAddingBranch(true)}
            className="px-2.5 py-1 bg-surface1 hover:bg-surface2 text-xs flex items-center gap-1 cursor-pointer rounded-sm"
          >
            <Plus className="w-3 h-3" />
            <span>{translateUiText('git.repositoryBranches.newBranch')}</span>
          </button>
        </div>

        {isAddingBranch && (
          <form
            onSubmit={handleCreateBranch}
            className="p-3 bg-crust border border-surface0 flex items-center gap-2 text-xs"
          >
            <input
              type="text"
              required
              placeholder={translateUiText('git.repositoryBranches.branchNamePlaceholder')}
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              className="flex-1 px-3 py-1.5 bg-surface0 border border-surface1 text-text focus:outline-none rounded-sm"
            />
            <CustomSelect
              value={newBranchBase}
              options={newBranchBaseOptions}
              onChange={setNewBranchBase}
              className="shrink-0"
              buttonClassName="min-w-36"
              dropdownWidth="w-56"
              align="left"
              aria-label={translateUiText('git.repositoryBranches.branchBase')}
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-brand hover:bg-brand/90 text-on-accent font-semibold cursor-pointer shadow-xs rounded-sm"
            >
              {translateUiText('git.repositoryBranches.createBranch')}
            </button>
            <button
              type="button"
              onClick={() => setIsAddingBranch(false)}
              className="px-2 py-1.5 bg-surface0 cursor-pointer rounded-sm"
            >
              {translateUiText('common.cancel')}
            </button>
          </form>
        )}

        <div className="max-h-40 overflow-y-auto divide-y divide-surface0 border border-surface0 bg-crust/50">
          {(branches?.local || []).map((b) => (
            <div key={b} className="px-3 py-2 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-mono">{b}</span>
                {b === branches?.current && (
                  <span className="text-[10px] px-1.5 py-[0.2rem] bg-surface1 text-text font-mono border border-surface2/40">
                    {translateUiText('git.repositoryBranches.currentHead')}
                  </span>
                )}
                {b === defaultBaseBranch && (
                  <span className="text-[10px] px-1.5 py-[0.2rem] bg-surface1 text-subtext0 font-mono border border-surface2/40">
                    {translateUiText('git.repositoryBranches.defaultBaseBadge')}
                  </span>
                )}
              </div>
              {b !== branches?.current && currentRepo && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(translateUiText('git.repositoryBranches.deleteBranchConfirm', { name: b }))) {
                      deleteBranch(b, true);
                      fetchBranches(currentRepo.local_path);
                    }
                  }}
                  className="p-1 hover:bg-red-500/20 text-subtext0 hover:text-red-400 cursor-pointer rounded-sm"
                  title={translateUiText('git.repositoryBranches.deleteBranch')}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* TAGS MANAGEMENT */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-xs text-text flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-subtext0" />
            <span>{translateUiText('git.repositoryBranches.releaseTags', { count: tags.length })}</span>
          </span>
          <button
            onClick={() => setIsAddingTag(true)}
            className="px-2.5 py-1 bg-surface1 hover:bg-surface2 text-xs flex items-center gap-1 cursor-pointer rounded-sm"
          >
            <Plus className="w-3 h-3" />
            <span>{translateUiText('git.repositoryBranches.createTag')}</span>
          </button>
        </div>

        {isAddingTag && (
          <form
            onSubmit={handleCreateTag}
            className="p-3 bg-crust border border-surface0 space-y-2 text-xs"
          >
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                required
                placeholder={translateUiText('git.repositoryBranches.tagNamePlaceholder')}
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                className="px-3 py-1.5 bg-surface0 border border-surface1 text-text focus:outline-none rounded-sm"
              />
              <input
                type="text"
                placeholder={translateUiText('git.repositoryBranches.annotatedMessagePlaceholder')}
                value={newTagMessage}
                onChange={(e) => setNewTagMessage(e.target.value)}
                className="px-3 py-1.5 bg-surface0 border border-surface1 text-text focus:outline-none rounded-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddingTag(false)}
                className="px-3 py-1 bg-surface0 cursor-pointer rounded-sm"
              >
                {translateUiText('common.cancel')}
              </button>
              <button
                type="submit"
                className="px-3 py-1 bg-brand hover:bg-brand/90 text-on-accent font-semibold cursor-pointer shadow-xs rounded-sm"
              >
                {translateUiText('git.repositoryBranches.createTag')}
              </button>
            </div>
          </form>
        )}

        <div className="max-h-40 overflow-y-auto divide-y divide-surface0 border border-surface0 bg-crust/50">
          {tags.length === 0 ? (
            <div className="p-4 text-center text-subtext0 text-xs">{translateUiText('git.repositoryBranches.noTags')}</div>
          ) : (
            tags.map((t) => (
              <div key={t.name} className="px-3 py-2 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-medium text-text">{t.name}</span>
                  <span className="font-mono text-[11px] text-subtext0">{t.commit_hash}</span>
                  {t.message && <span className="text-subtext1 italic truncate max-w-xs">{t.message}</span>}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(translateUiText('git.repositoryBranches.deleteTagConfirm', { name: t.name }))) {
                      deleteTag(t.name);
                    }
                  }}
                  className="p-1 hover:bg-red-500/20 text-subtext0 hover:text-red-400 cursor-pointer rounded-sm"
                  title={translateUiText('git.repositoryBranches.deleteTag')}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

