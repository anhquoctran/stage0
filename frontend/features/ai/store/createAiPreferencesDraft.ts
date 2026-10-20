import { create } from 'zustand';
import type { AiPreferencesSnapshot } from '../types/AiPreferencesSnapshot';
import type { AiPreferencesEditor } from '../types/AiPreferencesEditor';
import type { McpServerConfig } from '../types/McpServerConfig';
import type { McpConfigFileFormat } from '../types/McpConfigFileFormat';
import { DEFAULT_BOT_REVIEWERS } from '../constants/botPresets';
import { MCP_TRANSPORT_UNAVAILABLE } from '../constants/runtimeAvailability';
import { resetMcpVerification } from '../utils/resetMcpVerification';
import { guardrailPreset } from '../utils/guardrailPreset';

// This store has no persistence, IPC or global store access. All editing stays in this dialog.
export function createAiPreferencesDraft(initial: AiPreferencesSnapshot) {
  const id = () => `draft-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  return create<AiPreferencesEditor>((set, get) => ({
    ...structuredClone(initial), apiKeyDrafts: {}, apiKeyRemovals: [],
    replace: (snapshot) => set({ ...structuredClone(snapshot), apiKeyDrafts: {}, apiKeyRemovals: [] }),
    removeApiKey: (provider) => {
      const old = get();
      const apiKeyDrafts = { ...old.apiKeyDrafts };
      delete apiKeyDrafts[provider];
      set({
        apiKeyDrafts,
        apiKeyRemovals: old.apiKeyRemovals.includes(provider) ? old.apiKeyRemovals : [...old.apiKeyRemovals, provider],
        ...(old.aiConfig.provider === provider ? { aiConfig: { ...old.aiConfig, apiKey: '' } } : {}),
      });
    },
    updateAiConfig: (partial) => {
      const old = get(); const provider = partial.provider || old.aiConfig.provider;
      const apiKeyDrafts = { ...old.apiKeyDrafts };
      let apiKeyRemovals = old.apiKeyRemovals;
      if (partial.apiKey !== undefined) {
        if (partial.apiKey.trim()) {
          apiKeyDrafts[provider] = partial.apiKey;
          apiKeyRemovals = apiKeyRemovals.filter((id) => id !== provider);
        } else if (provider === old.aiConfig.provider) {
          delete apiKeyDrafts[provider];
        }
      }
      set({ apiKeyDrafts, apiKeyRemovals, aiConfig: { ...old.aiConfig, ...partial, apiKey: apiKeyDrafts[provider] || '' } });
    },
    addMcpServer: (server) => set({ mcpServers: [...get().mcpServers, resetMcpVerification({ ...structuredClone(server), id: id() })] }),
    updateMcpServer: (id, partial) => set({ mcpServers: get().mcpServers.map((server) => server.id === id ? resetMcpVerification({ ...server, ...structuredClone(partial) }) : server) }),
    deleteMcpServer: (id) => set({ mcpServers: get().mcpServers.filter((server) => server.id !== id) }),
    toggleMcpServer: (id) => set({ mcpServers: get().mcpServers.map((server) => server.id === id ? resetMcpVerification({ ...server, enabled: !server.enabled }) : server) }),
    testMcpServer: async (id) => {
      const server = get().mcpServers.find((server) => server.id === id);
      const invalid = !server || (server.type === 'stdio' ? !server.command.trim() : !server.url?.trim());
      const message = invalid ? 'Invalid local configuration. No server was contacted.' : MCP_TRANSPORT_UNAVAILABLE;
      set({ mcpServers: get().mcpServers.map((server) => server.id === id ? { ...resetMcpVerification(server), testStatus: invalid ? 'failed' : 'unavailable', testMessage: message } : server) });
      return { success: false, message };
    },
    importMcpConfigFile: (json) => {
      try {
        const parsed = JSON.parse(json) as McpConfigFileFormat;
        const servers = structuredClone(get().mcpServers); let count = 0;
        if (Array.isArray(parsed)) {
          for (const item of parsed) if (item?.name) { servers.push(resetMcpVerification({ ...item, id: item.id || id() })); count++; }
        } else if (parsed?.mcpServers && typeof parsed.mcpServers === 'object') {
          for (const [name, config] of Object.entries(parsed.mcpServers)) {
            const server: McpServerConfig = { id: name, name, description: `Imported MCP Server: ${name}`, type: config.url ? config.type === 'sse' ? 'sse' : 'http' : 'stdio', command: config.command || '', args: Array.isArray(config.args) ? config.args : [], env: config.env || {}, url: config.url, enabled: true, testStatus: 'untested' };
            const index = servers.findIndex((server) => server.id === name || server.name.toLowerCase() === name.toLowerCase());
            if (index >= 0) servers[index] = server; else servers.push(server); count++;
          }
        } else throw new Error('JSON must contain an mcpServers object or a server array.');
        set({ mcpServers: servers }); return { success: true, count };
      } catch { return { success: false, count: 0, error: 'Invalid MCP configuration JSON.' }; }
    },
    exportMcpConfigFile: () => JSON.stringify({ mcpServers: Object.fromEntries(get().mcpServers.map((server) => [server.name, server.type === 'stdio'
      ? { type: 'stdio', command: server.command, args: server.args, env: server.env }
      : { type: server.type, url: server.url, env: server.env }])) }, null, 2),
    updateGuardrailPolicy: async (partial) => set({ guardrailPolicy: { ...get().guardrailPolicy, ...structuredClone(partial) } }),
    resetGuardrailPolicy: async (mode) => set({ guardrailPolicy: guardrailPreset(mode) }),
    addGlobalReviewer: (bot) => { const nextId = id(); set({ globalReviewers: [...get().globalReviewers, { ...structuredClone(bot), id: nextId, isBuiltin: false }] }); return nextId; },
    updateGlobalReviewer: (id, partial) => set({ globalReviewers: get().globalReviewers.map((bot) => bot.id === id ? { ...bot, ...structuredClone(partial) } : bot) }),
    deleteGlobalReviewer: (id) => set({ globalReviewers: get().globalReviewers.filter((bot) => bot.id !== id) }),
    toggleGlobalReviewer: (id) => set({ globalReviewers: get().globalReviewers.map((bot) => bot.id === id ? { ...bot, enabled: !bot.enabled } : bot) }),
    resetGlobalReviewers: () => set({ globalReviewers: structuredClone(DEFAULT_BOT_REVIEWERS) }),
  }));
}
