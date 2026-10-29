import { useTranslation as useUiTextTranslation } from 'react-i18next';
import React from 'react';
import { Cable } from '../../../common/components/icons/Cable';
import { Plus } from '../../../common/components/icons/Plus';
import { RefreshCw } from '../../../common/components/icons/RefreshCw';
import { Edit3 } from '../../../common/components/icons/Edit3';
import { Trash2 } from '../../../common/components/icons/Trash2';
import { Terminal } from '../../../common/components/icons/Terminal';
import { Globe } from '../../../common/components/icons/Globe';
import { MCP_PRESET_TEMPLATES } from '../constants/aiPresets';
import type { McpServerConfig } from '../types/McpServerConfig';

export const AiMcpServersList: React.FC<{
  mcpServers: McpServerConfig[];
  onOpenAddServer: (preset?: (typeof MCP_PRESET_TEMPLATES)[number]) => void;
  onOpenEditServer: (server: McpServerConfig) => void;
  onToggleServer: (id: string) => void;
  onTestServer: (id: string) => void;
  onDeleteServer: (id: string) => void;
  testingServerId: string | null;
  deletingServerId: string | null;
  setDeletingServerId: (id: string | null) => void;
}> = ({
  mcpServers,
  onOpenAddServer,
  onOpenEditServer,
  onToggleServer,
  onTestServer,
  onDeleteServer,
  testingServerId,
  deletingServerId,
  setDeletingServerId,
}) => {
  const { t: translateUiText } = useUiTextTranslation();
  return (
    <div className="space-y-2.5">
      {mcpServers.length === 0 ? (
        <div className="p-8 border border-dashed border-surface1 text-center space-y-2.5 rounded-sm">
          <div className="w-10 h-10 bg-surface0 flex items-center justify-center mx-auto text-subtext0">
            <Cable className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-text">No MCP Servers Configured</h4>
            <p className="text-[11px] text-subtext0 max-w-sm mx-auto mt-0.5">
              Model Context Protocol servers allow your AI to read local files, execute Git diffs,
              and interact with repositories.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenAddServer(MCP_PRESET_TEMPLATES[0])}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-surface1 hover:bg-surface2 text-text text-xs font-semibold transition-colors cursor-pointer shadow-xs mt-1 rounded-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Default Git MCP Server</span>
          </button>
        </div>
      ) : (
        mcpServers.map((server) => {
          const envCount = Object.keys(server.env).length;
          return (
            <div
              key={server.id}
              className={`p-3.5 border transition-all space-y-2.5 rounded-sm ${
                server.enabled
                  ? 'bg-surface0/30 border-surface0 hover:border-surface1'
                  : 'bg-surface0/10 border-surface0/40 opacity-70'
              }`}
            >
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex min-w-0 flex-1 items-start gap-2.5">
                  <div
                    className={`w-8 h-8 shrink-0 border flex items-center justify-center text-text shadow-xs rounded-sm ${
                      server.enabled
                        ? 'bg-surface1 border-surface2'
                        : 'bg-surface0 border-surface0 text-subtext0'
                    }`}
                  >
                    <Cable className="w-4 h-4 text-subtext0" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-text">{server.name}</span>
                      <span className="text-[10px] px-2 py-0.2 bg-surface1 text-subtext0 border border-surface2 font-mono uppercase">
                        {server.type}
                      </span>

                      {envCount > 0 && (
                        <span className="text-[10px] px-1.5 py-0.2 bg-surface0 text-subtext1 border border-surface1 font-mono">
                          {envCount} env var{envCount > 1 ? 's' : ''}
                        </span>
                      )}

                      {server.testStatus === 'unavailable' && (
                        <span className="text-[10px] px-1.5 py-0.2 bg-surface1 text-text border border-surface2 font-mono flex items-center gap-1">
                          <span>Not connected</span>
                        </span>
                      )}
                    </div>

                    {server.description && (
                      <p className="text-[11px] text-subtext0 mt-0.5 line-clamp-1">
                        {server.description}
                      </p>
                    )}
                    <p className="text-[11px] text-subtext0 mt-1" role="status">
                      {server.testMessage || 'Not attached to harness. Use the external connectors panel for explicit HTTP discovery.'}
                    </p>
                  </div>
                </div>

                {/* Server Controls */}
                <div className="ms-auto flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                  {/* Enable/Disable Toggle */}
                  <button
                    type="button"
                    onClick={() => onToggleServer(server.id)}
                    className={`shrink-0 whitespace-nowrap px-2 py-1 text-[11px] font-semibold transition-all cursor-pointer rounded-sm ${
                      server.enabled
                        ? 'bg-surface1 border-surface2 text-text shadow-xs'
                        : 'bg-surface0/50 border-surface0 text-subtext0 hover:text-text'
                    }`}
                    title="Saved preference only; this does not start or connect an MCP server"
                  >
                    {server.enabled ? 'Configured on' : 'Configured off'}
                  </button>

                  {/* Ping / Test Handshake */}
                  <button
                    type="button"
                    onClick={() => onTestServer(server.id)}
                    disabled={testingServerId === server.id}
                    className="p-1.5 border border-surface1 hover:bg-surface1 text-subtext0 hover:text-text transition-colors cursor-pointer rounded-sm"
                    title="Validate saved configuration only. Use the external connectors panel for HTTP discovery."
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${
                        testingServerId === server.id ? 'animate-spin text-text' : ''
                      }`}
                    />
                  </button>

                  {/* Edit Button */}
                  <button
                    type="button"
                    onClick={() => onOpenEditServer(server)}
                    className="p-1.5 border border-surface1 hover:bg-surface1 text-subtext0 hover:text-text transition-colors cursor-pointer rounded-sm"
                    title="Edit Server Configuration"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete Button */}
                  {deletingServerId === server.id ? (
                    <div className="flex items-center gap-1 bg-surface1 p-0.5 border border-red/40 rounded-sm">
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteServer(server.id);
                          setDeletingServerId(null);
                        }}
                        className="px-2 py-0.5 bg-red/20 hover:bg-red/30 text-red text-[11px] font-medium transition-colors cursor-pointer rounded-sm"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingServerId(null)}
                        className="px-1.5 py-0.5 text-subtext0 hover:text-text text-[11px] transition-colors cursor-pointer rounded-sm"
                      >
                        {translateUiText('common.cancel')}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeletingServerId(server.id)}
                      className="p-1.5 border border-surface1 hover:bg-red/10 text-subtext0 hover:text-red transition-colors cursor-pointer rounded-sm"
                      title="Remove MCP Server"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Command or URL Representation */}
              <div className="p-2 bg-base/50 border border-surface0 flex items-center justify-between text-[11px] font-mono rounded-sm">
                <div className="flex items-center gap-2 truncate text-subtext0">
                  {server.type === 'stdio' ? (
                    <>
                      <Terminal className="w-3 h-3 text-subtext0 shrink-0" />
                      <span className="text-text font-bold">{server.command}</span>
                      <span className="truncate">{server.args.join(' ')}</span>
                    </>
                  ) : (
                    <>
                      <Globe className="w-3 h-3 text-subtext0 shrink-0" />
                      <span className="text-text font-bold">{server.url}</span>
                    </>
                  )}
                </div>

                {server.lastTestedAt && (
                  <span className="text-[10px] text-subtext0/70 shrink-0 ps-2">
                    Checked {server.lastTestedAt}
                  </span>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

