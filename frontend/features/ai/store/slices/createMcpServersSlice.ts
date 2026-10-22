import type { StateCreator } from 'zustand';
import { MCP_TRANSPORT_UNAVAILABLE } from '../../constants/runtimeAvailability';
import { loadPersistedState, persistState } from '../../services/aiMcpPersistence';
import type { AiMcpState } from '../../types/AiMcpState';
import { type McpConfigFileFormat } from '../../types/McpConfigFileFormat';
import { type McpServerConfig } from '../../types/McpServerConfig';
import { publicMcpEnv } from '../../utils/listSecretMcpEnv';
import { resetMcpVerification } from '../../utils/resetMcpVerification';

export const createMcpServersSlice =
  (
    initialState: ReturnType<typeof loadPersistedState>
  ): StateCreator<
    AiMcpState,
    [],
    [],
    Pick<
      AiMcpState,
      | 'mcpServers'
      | 'addMcpServer'
      | 'updateMcpServer'
      | 'deleteMcpServer'
      | 'toggleMcpServer'
      | 'testMcpServer'
      | 'importMcpConfigFile'
      | 'exportMcpConfigFile'
    >
  > =>
  (set, get) => ({
    mcpServers: initialState.mcpServers,

    addMcpServer: (serverData) => {
      const id = `mcp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newServer: McpServerConfig = resetMcpVerification({
        ...serverData,
        id,
        enabled: serverData.enabled ?? true,
        testStatus: 'untested',
      });
      const nextServers = [...get().mcpServers, newServer];
      set({ mcpServers: nextServers });
      persistState(get().aiConfig, nextServers, get().guardrailPolicy, get().externalAgents);
    },

    updateMcpServer: (id, updates) => {
      const nextServers = get().mcpServers.map((s) =>
        s.id === id ? resetMcpVerification({ ...s, ...updates }) : s
      );
      set({ mcpServers: nextServers });
      persistState(get().aiConfig, nextServers, get().guardrailPolicy, get().externalAgents);
    },

    deleteMcpServer: (id) => {
      const nextServers = get().mcpServers.filter((s) => s.id !== id);
      set({ mcpServers: nextServers });
      persistState(get().aiConfig, nextServers, get().guardrailPolicy, get().externalAgents);
    },

    toggleMcpServer: (id) => {
      const nextServers = get().mcpServers.map((s) =>
        s.id === id ? resetMcpVerification({ ...s, enabled: !s.enabled }) : s
      );
      set({ mcpServers: nextServers });
      persistState(get().aiConfig, nextServers, get().guardrailPolicy, get().externalAgents);
    },

    testMcpServer: async (id) => {
      const server = get().mcpServers.find((s) => s.id === id);
      if (!server) {
        return { success: false, message: 'Server not found' };
      }

      const invalid =
        server.type === 'stdio' && !server.command.trim()
          ? 'Executable command cannot be empty for stdio.'
          : server.type !== 'stdio' && !server.url?.trim()
            ? 'HTTP URL cannot be empty.'
            : null;
      const message = invalid
        ? `Invalid local configuration: ${invalid} No server was contacted.`
        : MCP_TRANSPORT_UNAVAILABLE;
      // Config validation is not a transport handshake or tool discovery.
      const nextServers = get().mcpServers.map((item) =>
        item.id === id
          ? {
              ...resetMcpVerification(item),
              testStatus: invalid ? ('failed' as const) : ('unavailable' as const),
              testMessage: message,
            }
          : item
      );
      set({ mcpServers: nextServers });
      persistState(get().aiConfig, get().mcpServers, get().guardrailPolicy, get().externalAgents);
      return { success: false, message };
    },

    importMcpConfigFile: (jsonStr) => {
      try {
        const parsed = JSON.parse(jsonStr) as McpConfigFileFormat;
        if (!parsed || typeof parsed !== 'object') {
          return { success: false, count: 0, error: 'Invalid JSON format' };
        }

        let importedCount = 0;
        const currentServers = [...get().mcpServers];

        // Handle standard "mcpServers" object format (Claude Desktop / VSCode)
        if (parsed.mcpServers && typeof parsed.mcpServers === 'object') {
          for (const [key, conf] of Object.entries(parsed.mcpServers)) {
            const existingIdx = currentServers.findIndex(
              (s) => s.name.toLowerCase() === key.toLowerCase() || s.id === key
            );

            const isHttp = Boolean(conf.url);
            const serverEntry: McpServerConfig = {
              id: key,
              name: key,
              description: `Imported MCP Server: ${key}`,
              type: isHttp ? (conf.type === 'sse' ? 'sse' : 'http') : 'stdio',
              command: conf.command || '',
              args: Array.isArray(conf.args) ? conf.args : [],
              env: conf.env || {},
              url: conf.url,
              enabled: true,
              testStatus: 'untested',
            };

            if (existingIdx >= 0) {
              currentServers[existingIdx] = serverEntry;
            } else {
              currentServers.push(serverEntry);
            }
            importedCount++;
          }
        } else if (Array.isArray(parsed)) {
          // Direct array of servers
          for (const item of parsed) {
            if (item && item.name) {
              currentServers.push({
                ...resetMcpVerification(item),
                id: item.id || `mcp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              });
              importedCount++;
            }
          }
        } else {
          return {
            success: false,
            count: 0,
            error: 'JSON must contain an "mcpServers" object or an array of server configs',
          };
        }

        set({ mcpServers: currentServers });
        persistState(get().aiConfig, currentServers, get().guardrailPolicy, get().externalAgents);
        return { success: true, count: importedCount };
      } catch (e: unknown) {
        return {
          success: false,
          count: 0,
          error: e instanceof Error ? e.message : 'Invalid JSON file',
        };
      }
    },

    exportMcpConfigFile: () => {
      const { mcpServers } = get();
      const exportObj: McpConfigFileFormat = {
        mcpServers: {},
      };

      for (const server of mcpServers) {
        const env = publicMcpEnv(server.env ?? {}, server.secretEnvKeys ?? []);
        if (server.type !== 'stdio') {
          exportObj.mcpServers[server.name] = {
            type: server.type,
            url: server.url,
            env: Object.keys(env).length > 0 ? env : undefined,
          };
        } else {
          exportObj.mcpServers[server.name] = {
            type: 'stdio',
            command: server.command,
            args: server.args,
            env: Object.keys(env).length > 0 ? env : undefined,
          };
        }
      }

      return JSON.stringify(exportObj, null, 2);
    },
  });
