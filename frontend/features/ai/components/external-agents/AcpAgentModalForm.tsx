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
  return (
    <Modal title="Add custom ACP agent" onClose={() => setIsCustomOpen(false)}>
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
          Name
          <input
            value={customName}
            onChange={(event) => setCustomName(event.target.value)}
            className="mt-1 w-full border border-surface1 bg-base px-2.5 py-2 text-xs rounded-sm"
          />
        </label>
        <label className="block text-xs">
          Command
          <input
            value={customCommand}
            onChange={(event) => setCustomCommand(event.target.value)}
            placeholder="npx"
            className="mt-1 w-full border border-surface1 bg-base px-2.5 py-2 font-mono text-xs rounded-sm"
          />
        </label>
        <label className="block text-xs">
          Arguments <span className="text-subtext0">(one per line)</span>
          <textarea
            rows={4}
            value={customArgs}
            onChange={(event) => setCustomArgs(event.target.value)}
            placeholder={'-y\n@vendor/agent-acp'}
            className="mt-1 w-full border border-surface1 bg-base px-2.5 py-2 font-mono text-xs rounded-sm"
          />
        </label>
        <p className="text-[11px] text-subtext0">
          Only add agents you trust. Stage0 starts this command locally and communicates over ACP
          stdio.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setIsCustomOpen(false)}
            className="border border-surface2 px-3 py-1.5 text-xs rounded-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="border border-brand/50 bg-brand/10 px-3 py-1.5 text-xs text-brand rounded-sm"
          >
            Add agent
          </button>
        </div>
      </form>
    </Modal>
  );
}
