import { invoke } from '../../../common/services/ipc/ipcClient';
import { useState } from 'react';
import type { AcpAgentPromptContext } from './AcpAgentPromptContext';

export function useAcpAgentPrompt({
  detailAgent,
  setError,
  currentRepoPath,
}: AcpAgentPromptContext) {
  const [prompt, setPrompt] = useState('What can you help me with?');

  const [response, setResponse] = useState('');

  const [isSendingPrompt, setIsSendingPrompt] = useState(false);

  const sendPrompt = async () => {
    if (!detailAgent || !prompt.trim()) return;
    setIsSendingPrompt(true);
    setError(null);
    setResponse('');
    try {
      const result = await invoke<string>('acp_agent_prompt', {
        config: detailAgent,
        prompt,
        cwd: currentRepoPath,
      });
      setResponse(result);
    } catch (cause) {
      setError(String(cause));
    } finally {
      setIsSendingPrompt(false);
    }
  };

  return { setPrompt, setResponse, prompt, isSendingPrompt, sendPrompt, response };
}
