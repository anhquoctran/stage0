import { Trash2 } from '../../../../common/components/icons/Trash2';
import { useTranslation } from 'react-i18next';
import { ExternalAgentsModal as Modal } from '../ExternalAgentsModal';
import { AcpAgentAccountSection } from './AcpAgentAccountSection';
import type { AcpAgentDetailsProps } from './AcpAgentDetailsProps';
import { AcpAgentProjectInfo } from './AcpAgentProjectInfo';
import { AcpAgentPromptSection } from './AcpAgentPromptSection';

export function AcpAgentDetails({
  project,
  dialog: {
    setDetailAgent,
    setDetailRegistryEntry,
    error,
    notice,
    setRemovePending,
    removePending,
    removeAgent,
  },
  account,
  promptSession,
}: AcpAgentDetailsProps) {
  const { detailAgent } = project;
  const { t } = useTranslation();
  return (
    <Modal
      title={detailAgent.name}
      onClose={() => {
        setDetailAgent(null);
        setDetailRegistryEntry(null);
      }}
    >
      <div className="space-y-4">
        {error && (
          <p
            role="status"
            className="border border-yellow/40 bg-yellow/5 px-3 py-2 text-xs text-yellow"
          >
            {error}
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="border border-green/40 bg-green/5 px-3 py-2 text-xs text-green"
          >
            {notice}
          </p>
        )}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">
              {detailAgent.name}
              {detailAgent.version ? ` · ${detailAgent.version}` : ''}
            </p>
            <p className="mt-1 text-xs text-subtext0">
              {detailAgent.description || t('ai.externalAgents.customAcpAgent')} ·{' '}
              {detailAgent.launchMode === 'binary'
                ? t('ai.externalAgents.nativeBinaryCommand', { command: detailAgent.command })
                : `${detailAgent.command} ${detailAgent.args.join(' ')}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRemovePending(true)}
            className="flex items-center gap-1.5 border border-red/40 px-2.5 py-1.5 text-xs text-red hover:bg-red/10 rounded-sm"
          >
            <Trash2 className="h-3.5 w-3.5" /> {t('ai.externalAgents.uninstall')}
          </button>
        </div>
        <AcpAgentProjectInfo project={project} />
        {removePending && (
          <div className="flex flex-wrap items-center justify-between gap-2 border border-red/40 bg-red/5 p-3 text-xs rounded-sm">
            <span>
              {t('ai.externalAgents.uninstallConfirmation')}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRemovePending(false)}
                className="border border-surface2 px-2.5 py-1.5 rounded-sm"
              >
                {t('ai.externalAgents.keep')}
              </button>
              <button
                type="button"
                onClick={removeAgent}
                className="border border-red/50 px-2.5 py-1.5 text-red rounded-sm"
              >
                {t('ai.externalAgents.uninstall')}
              </button>
            </div>
          </div>
        )}
        <AcpAgentAccountSection account={account} agentId={detailAgent.id} />
        <p className="border border-surface1 px-3 py-2 text-[11px] text-subtext0">
          {t('ai.externalAgents.agentWorkspaceNotice')}
        </p>
        <AcpAgentPromptSection promptSession={promptSession} />
      </div>
    </Modal>
  );
}
