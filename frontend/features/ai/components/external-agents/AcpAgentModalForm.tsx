import { useTranslation as useUiTextTranslation } from 'react-i18next';
import { ExternalAgentsModal as Modal } from '../ExternalAgentsModal';
import type { AcpAgentModalFormProps } from './AcpAgentModalFormProps';

export function AcpAgentModalForm({
  setIsCustomOpen,
  addCustomAgent,
  error,
  customName,
  setCustomName,
  customCommand,
  setCustomCommand,
  customArgs,
  setCustomArgs,
}: AcpAgentModalFormProps) {
  const { t: translateUiText } = useUiTextTranslation();
  return (
    <Modal title={translateUiText('ai.externalAgents.addCustomAgent')} onClose={() => setIsCustomOpen(false)}>
      <form onSubmit={addCustomAgent} className="space-y-3">
        {error && (
          <p
            role="status"
            className="border border-yellow/40 bg-yellow/5 px-3 py-2 text-xs text-yellow"
          >
            {error}
          </p>
        )}
        <label className="block text-xs">
          {translateUiText('ai.externalAgents.name')}
          <input
            value={customName}
            onChange={(event) => setCustomName(event.target.value)}
            className="mt-1 w-full border border-surface1 bg-base px-2.5 py-2 text-xs rounded-sm"
          />
        </label>
        <label className="block text-xs">
          {translateUiText('ai.externalAgents.command')}
          <input
            value={customCommand}
            onChange={(event) => setCustomCommand(event.target.value)}
            placeholder="npx"
            className="mt-1 w-full border border-surface1 bg-base px-2.5 py-2 font-mono text-xs rounded-sm"
          />
        </label>
        <label className="block text-xs">
          {translateUiText('ai.externalAgents.arguments')} <span className="text-subtext0">({translateUiText('ai.externalAgents.onePerLine')})</span>
          <textarea
            rows={4}
            value={customArgs}
            onChange={(event) => setCustomArgs(event.target.value)}
            placeholder={'-y\n@vendor/agent-acp'}
            className="mt-1 w-full border border-surface1 bg-base px-2.5 py-2 font-mono text-xs rounded-sm"
          />
        </label>
        <p className="text-[11px] text-subtext0">
          {translateUiText('ai.externalAgents.trustNotice')}
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setIsCustomOpen(false)}
            className="border border-surface2 px-3 py-1.5 text-xs rounded-sm"
          >
            {translateUiText('common.cancel')}
          </button>
          <button
            type="submit"
            className="px-3 py-1.5 text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white rounded-sm shadow-xs transition-colors cursor-pointer"
          >
            {translateUiText('ai.externalAgents.addAgent')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
