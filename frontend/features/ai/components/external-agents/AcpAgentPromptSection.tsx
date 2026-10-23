import { isTauri } from '@tauri-apps/api/core';
import type { AcpAgentDetailsProps } from './AcpAgentDetailsProps';

export function AcpAgentPromptSection({
  promptSession: { currentRepoPath, prompt, setPrompt, isSendingPrompt, sendPrompt, response },
}: Pick<AcpAgentDetailsProps, 'promptSession'>) {
  return (
    <section className="space-y-2 border-t border-surface1 pt-4">
      <h3 className="text-xs font-semibold">Send a prompt</h3>
      <p className="break-all text-[11px] text-subtext0">
        Working directory:{' '}
        {currentRepoPath || 'No repository open; using Stage0’s working directory.'}
      </p>
      <textarea
        rows={3}
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        className="w-full resize-y border border-surface1 bg-base px-2.5 py-2 text-xs outline-none focus:border-surface2"
      />
      <button
        type="button"
        disabled={isSendingPrompt || !prompt.trim() || !isTauri()}
        onClick={() => void sendPrompt()}
        className="border border-surface2 px-3 py-1.5 text-xs disabled:opacity-50"
      >
        {isSendingPrompt ? 'Waiting for agent…' : 'Send prompt'}
      </button>
      {response && (
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap border border-surface1 bg-base p-3 text-xs">
          {response}
        </pre>
      )}
    </section>
  );
}
