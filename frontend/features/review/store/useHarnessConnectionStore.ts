import { getApplicationServices } from '../../../core/services/runtime/applicationRuntime';
import { create } from 'zustand';

import type { HarnessConnectionState } from '../types/HarnessConnectionState';
import { useAiMcpStore } from '../../ai/store/useAiMcpStore';
import { mcpConnectionKey } from '../utils/mcpConnectionKey';

let requestId = 0;
const message = (error: unknown) => error instanceof Error ? error.message : String(error);

// Deliberately ephemeral: catalog discovery never becomes persisted authority.
export const useHarnessConnectionStore = create<HarnessConnectionState>((set, get) => ({
  mcp: {}, cli: null, cliError: null, isInspectingCli: false,
  discover: async (server, allowNetwork) => {
    const requestKey = mcpConnectionKey(server);
    if (get().mcp[server.id]?.status === 'discovering' && get().mcp[server.id]?.requestKey === requestKey) return;
    const attempt = ++requestId;
    set((state) => ({ mcp: { ...state.mcp, [server.id]: { requestKey, requestId: attempt, status: 'discovering', report: null, error: null } } }));
    try {
      if (!allowNetwork) throw new Error('Explicit source-free discovery consent is required. No server was contacted.');
      if (!server.enabled || server.type !== 'http') throw new Error('Only configured-on Streamable HTTP connections support discovery. Stdio/SSE are not launched.');
      if (!getApplicationServices().platform.capabilities.backend) throw new Error('External connector discovery requires the native desktop app.');
      const report = await getApplicationServices().harness.discoverHarnessMcp({ request: { connectionId: server.id, url: server.url || '', allowNetwork: true } });
      if (report.connectionId !== server.id || report.attachedToHarness !== false) throw new Error('Invalid discovery report; external tools were not attached.');
      const current = useAiMcpStore.getState().mcpServers.find((item) => item.id === server.id);
      if (!current || mcpConnectionKey(current) !== requestKey || get().mcp[server.id]?.requestId !== attempt) return;
      set((state) => ({ mcp: { ...state.mcp, [server.id]: { requestKey, requestId: attempt, status: 'discovered', report, error: null } } }));
    } catch (error) {
      if (get().mcp[server.id]?.requestId === attempt) set((state) => ({ mcp: { ...state.mcp, [server.id]: { requestKey, requestId: attempt, status: 'failed', report: null, error: message(error) } } }));
    } finally {
      if (get().mcp[server.id]?.requestId === attempt && get().mcp[server.id]?.status === 'discovering') {
        set((state) => { const mcp = { ...state.mcp }; delete mcp[server.id]; return { mcp }; });
      }
    }
  },
  inspectCli: async (cliType) => {
    if (get().isInspectingCli) return;
    set({ isInspectingCli: true, cli: null, cliError: null });
    try {
      if (!getApplicationServices().platform.capabilities.backend) throw new Error('CLI preflight requires the native desktop app.');
      const cli = await getApplicationServices().harness.inspectHarnessCli({ cliType });
      if (cli.cliType !== cliType || cli.attachedToHarness !== false) throw new Error('Invalid CLI readiness report.');
      set({ cli });
    } catch (error) { set({ cliError: message(error) }); }
    finally { set({ isInspectingCli: false }); }
  },
}));
