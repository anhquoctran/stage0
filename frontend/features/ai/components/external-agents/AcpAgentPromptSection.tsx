import { useApplicationServices } from '../../../../core/services/runtime/useApplicationServices';
import { useTranslation } from 'react-i18next';

import type { AcpAgentDetailsProps } from './AcpAgentDetailsProps';

export function AcpAgentPromptSection({
  promptSession: { currentRepoPath, prompt, setPrompt, isSendingPrompt, sendPrompt, response },
}: Pick<AcpAgentDetailsProps, 'promptSession'>) {
  const appServices = useApplicationServices();
  const { t } = useTranslation();
  return (
    <section className="space-y-2 border-t border-surface1 pt-4">
      <h3 className="text-xs font-semibold">{t('ai.externalAgents.sendPromptTitle')}</h3>
      <p className="break-all text-[11px] text-subtext0">
        {t('ai.externalAgents.workingDirectory')}: {currentRepoPath || t('ai.externalAgents.noRepositoryWorkingDirectory')}
      </p>
      <textarea
        rows={3}
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        className="w-full resize-y border border-surface1 bg-base px-2.5 py-2 text-xs outline-none focus:border-surface2 rounded-sm"
      />
      <button
        type="button"
        disabled={isSendingPrompt || !prompt.trim() || !appServices.platform.capabilities.externalAgents}
        onClick={() => void sendPrompt()}
        className="border border-surface2 px-3 py-1.5 text-xs disabled:opacity-50 rounded-sm"
      >
        {isSendingPrompt ? t('ai.externalAgents.waitingForAgent') : t('ai.externalAgents.sendPrompt')}
      </button>
      {response && (
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap border border-surface1 bg-base p-3 text-xs">
          {response}
        </pre>
      )}
    </section>
  );
}
