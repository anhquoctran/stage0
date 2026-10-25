import type { CustomSelectOption } from '../../../common/types/CustomSelectOption';
import type { McpServerType } from '../types/McpServerType';
import { BOT_CATEGORIES } from './botPresets';
import type { BotCategory } from '../../virtual-mr/types/BotCategory';
import { invoke, isTauri } from '../../../common/services/ipc/ipcClient';

export const MAX_TOKEN_OPTIONS: CustomSelectOption<string>[] = [
  { value: '1024', label: '1,024 Tokens (Compact)' },
  { value: '2048', label: '2,048 Tokens (Standard)' },
  { value: '4096', label: '4,096 Tokens (Recommended for Diffs)' },
  { value: '8192', label: '8,192 Tokens (Large MR Review)' },
  { value: '16384', label: '16,384 Tokens (Deep Reasoning / Extended)' },
];

export const MCP_SERVER_TYPE_OPTIONS: CustomSelectOption<McpServerType>[] = [
  { value: 'stdio', label: 'stdio (Command / Subprocess)' },
  { value: 'http', label: 'Streamable HTTP (MCP 2025-11-25 discovery)' },
  { value: 'sse', label: 'Legacy HTTP+SSE (configuration only)' },
];

export const PROMPT_ROLE_OPTIONS: CustomSelectOption<BotCategory>[] = BOT_CATEGORIES.map((category) => ({
  value: category.id,
  label: category.label,
}));

export const openUrlInBrowser = async (url: string) => {
  if (isTauri()) {
    try {
      await invoke('open_external_url', { url });
      return;
    } catch {
      // fallback
    }
  }
  window.open(url, '_blank');
};

