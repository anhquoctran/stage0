import { useTranslation } from 'react-i18next';
import { Trash2 } from '../../../../common/components/icons/Trash2';
import type { SandboxInstanceCardProps } from './SandboxInstanceCardProps';

export function SandboxInstanceCard({
  inst,
  setSelectedInstanceId,
  selectedInstanceId,
  activeSandboxInstances,
  destroySandboxInstance,
}: SandboxInstanceCardProps) {
  const { t } = useTranslation();
  return (
    <div
      key={inst.id}
      role="button"
      tabIndex={0}
      onClick={() => setSelectedInstanceId(inst.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setSelectedInstanceId(inst.id);
        }
      }}
      className={`flex items-center justify-between p-2.5 rounded-sm border text-xs transition-colors cursor-pointer ${
        selectedInstanceId === inst.id ||
        (activeSandboxInstances.length === 1 && !selectedInstanceId)
          ? 'bg-surface1 border-surface2'
          : 'bg-base/40 border-surface0 hover:border-surface1'
      }`}
    >
      <div className="font-mono space-y-0.5 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-text">{inst.id}</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-sm bg-surface0 text-subtext0 uppercase">
            {inst.adapter_type}
          </span>
        </div>
        <div className="text-[10px] text-subtext0 truncate">
          {inst.worktree_path || inst.container_id || inst.repo_path}
        </div>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          destroySandboxInstance(inst.id);
        }}
        className="p-1 rounded-sm text-subtext0 hover:text-text hover:bg-surface2 transition-colors cursor-pointer"
        title={t('ai.sandbox.destroyInstance')}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
