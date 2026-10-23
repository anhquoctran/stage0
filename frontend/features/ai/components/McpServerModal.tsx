import React from 'react';
import { Cable } from '../../../common/components/icons/Cable';
import { X } from '../../../common/components/icons/X';
import { AlertCircle } from '../../../common/components/icons/AlertCircle';
import { Terminal } from '../../../common/components/icons/Terminal';
import { Globe } from '../../../common/components/icons/Globe';
import { Plus } from '../../../common/components/icons/Plus';
import { Check } from '../../../common/components/icons/Check';
import { CustomSelect } from '../../../common/components/CustomSelect';
import type { CustomSelectOption } from '../../../common/types/CustomSelectOption';
import type { McpServerType } from '../types/McpServerType';
import { isLikelySecretMcpEnvValue, isSecretMcpEnvName } from '../utils/listSecretMcpEnv';

const MCP_SERVER_TYPE_OPTIONS: CustomSelectOption<McpServerType>[] = [
  { value: 'stdio', label: 'stdio (Command / Subprocess)' },
  { value: 'http', label: 'Streamable HTTP (MCP 2025-11-25 discovery)' },
  { value: 'sse', label: 'Legacy HTTP+SSE (configuration only)' },
];

export const McpServerModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (e: React.FormEvent) => void;
  editingServerId: string | null;
  formError: string | null;
  serverName: string;
  setServerName: (v: string) => void;
  serverType: McpServerType;
  setServerType: (v: McpServerType) => void;
  serverDesc: string;
  setServerDesc: (v: string) => void;
  serverCommand: string;
  setServerCommand: (v: string) => void;
  serverArgsStr: string;
  setServerArgsStr: (v: string) => void;
  serverUrl: string;
  setServerUrl: (v: string) => void;
  serverEnvPairs: Array<{ key: string; value: string; secretConfigured?: boolean; savedKey?: string }>;
  setServerEnvPairs: React.Dispatch<React.SetStateAction<Array<{ key: string; value: string; secretConfigured?: boolean; savedKey?: string }>>>;
}> = ({
  isOpen,
  onClose,
  onSave,
  editingServerId,
  formError,
  serverName,
  setServerName,
  serverType,
  setServerType,
  serverDesc,
  setServerDesc,
  serverCommand,
  setServerCommand,
  serverArgsStr,
  setServerArgsStr,
  serverUrl,
  setServerUrl,
  serverEnvPairs,
  setServerEnvPairs,
}) => {
  if (!isOpen) return null;

  return (
    <form
      onSubmit={onSave}
      className="p-4 bg-surface0/60 border border-surface1 space-y-4 animate-in fade-in zoom-in-98 duration-150"
    >
      <div className="flex items-center justify-between pb-2 border-b border-surface1/60">
        <span className="text-xs font-bold text-text flex items-center gap-1.5">
          <Cable className="w-3.5 h-3.5 text-subtext0" />
          {editingServerId ? 'Edit MCP Server' : 'Add New MCP Server'}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-subtext0 hover:text-text cursor-pointer rounded-sm"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {formError && (
        <div className="p-2.5 bg-red/10 border border-red/30 text-xs text-red flex items-center gap-2 rounded-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {/* Server Name */}
        <div className="col-span-2">
          <label className="block text-[11px] font-medium text-subtext0 mb-1">
            Server Name <span className="text-red">*</span>
          </label>
          <input
            type="text"
            value={serverName}
            onChange={(e) => setServerName(e.target.value)}
            placeholder="e.g. Git Context, Workspace Filesystem"
            required
            className="w-full px-3 py-1.5 bg-base border border-surface1 text-xs text-text placeholder:text-subtext0 focus:outline-none focus:border-surface2 rounded-sm"
          />
        </div>

        {/* Transport Type */}
        <div>
          <label className="block text-[11px] font-medium text-subtext0 mb-1">
            Transport Protocol
          </label>
          <CustomSelect
            value={serverType}
            options={MCP_SERVER_TYPE_OPTIONS}
            onChange={setServerType}
            className="w-full"
            buttonClassName="w-full"
            dropdownWidth="w-full"
            align="left"
            aria-label="Transport Protocol"
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-[11px] font-medium text-subtext0 mb-1">
          Description <span className="text-subtext0/60 font-normal">(Optional)</span>
        </label>
        <input
          type="text"
          value={serverDesc}
          onChange={(e) => setServerDesc(e.target.value)}
          placeholder="e.g. Provides read access to git branches and diff graphs"
          className="w-full px-3 py-1.5 bg-base border border-surface1 text-xs text-text placeholder:text-subtext0 focus:outline-none focus:border-surface2 rounded-sm"
        />
      </div>

      {/* Stdio Commands & Args */}
      {serverType === 'stdio' ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-subtext0 mb-1">
                Executable Command <span className="text-red">*</span>
              </label>
              <div className="relative flex items-center">
                <Terminal className="w-3.5 h-3.5 text-subtext0 absolute left-2.5" />
                <input
                  type="text"
                  value={serverCommand}
                  onChange={(e) => setServerCommand(e.target.value)}
                  placeholder="npx, uvx, docker, python"
                  required
                  className="w-full pl-8 pr-3 py-1.5 bg-base border border-surface1 text-xs text-text font-mono placeholder:text-subtext0 focus:outline-none focus:border-surface2 rounded-sm"
                />
              </div>
            </div>

            <div className="col-span-2">
              <label className="block text-[11px] font-medium text-subtext0 mb-1">
                Arguments (space-separated)
              </label>
              <input
                type="text"
                value={serverArgsStr}
                onChange={(e) => setServerArgsStr(e.target.value)}
                placeholder="-y @modelcontextprotocol/server-filesystem ."
                className="w-full px-3 py-1.5 bg-base border border-surface1 text-xs text-text font-mono placeholder:text-subtext0 focus:outline-none focus:border-surface2 rounded-sm"
              />
            </div>
          </div>
        </div>
      ) : (
        /* HTTP endpoint */
        <div>
          <label className="block text-[11px] font-medium text-subtext0 mb-1">
            {serverType === 'http' ? 'Streamable HTTP Endpoint URL' : 'Legacy SSE Endpoint URL'} <span className="text-red">*</span>
          </label>
          <div className="relative flex items-center">
            <Globe className="w-3.5 h-3.5 text-subtext0 absolute left-2.5" />
            <input
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder={serverType === 'http' ? 'http://localhost:8000/mcp' : 'http://localhost:8000/sse'}
              required
              className="w-full pl-8 pr-3 py-1.5 bg-base border border-surface1 text-xs text-text font-mono placeholder:text-subtext0 focus:outline-none focus:border-surface2 rounded-sm"
            />
          </div>
        </div>
      )}

      {/* Environment Variables (Key-Value) */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] font-medium text-subtext0">
            Environment Variables
          </label>
          <button
            type="button"
            onClick={() =>
              setServerEnvPairs([...serverEnvPairs, { key: '', value: '' }])
            }
            className="flex items-center gap-1 text-[10px] text-subtext0 hover:text-text px-2 py-0.5 hover:bg-surface1 transition-colors cursor-pointer rounded-sm"
          >
            <Plus className="w-3 h-3" />
            <span>Add Variable</span>
          </button>
        </div>

        <p className="text-[10px] text-subtext0 mb-2">
          Secret-named variables are stored in your OS keychain and never included in preferences or exports. Leave a saved secret blank to keep it unchanged; enter a new value to replace it.
        </p>

        {serverEnvPairs.length > 0 ? (
          <div className="space-y-1.5">
            {serverEnvPairs.map((pair, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={pair.key}
                  onChange={(e) => {
                    const copy = [...serverEnvPairs];
                    copy[idx].key = e.target.value;
                    setServerEnvPairs(copy);
                  }}
                  placeholder="VARIABLE_NAME"
                  className="flex-1 px-2.5 py-1 bg-base border border-surface1 text-xs text-text font-mono placeholder:text-subtext0 focus:outline-none rounded-sm"
                />
                <input
                  type={isSecretMcpEnvName(pair.key) || isLikelySecretMcpEnvValue(pair.value) || pair.secretConfigured ? 'password' : 'text'}
                  value={pair.value}
                  onChange={(e) => {
                    const copy = [...serverEnvPairs];
                    copy[idx].value = e.target.value;
                    setServerEnvPairs(copy);
                  }}
                  placeholder={pair.secretConfigured && pair.savedKey === pair.key ? 'Saved in OS Keychain · blank keeps current value' : 'value'}
                  className="flex-1 px-2.5 py-1 bg-base border border-surface1 text-xs text-text font-mono placeholder:text-subtext0 focus:outline-none rounded-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    setServerEnvPairs(serverEnvPairs.filter((_, i) => i !== idx));
                  }}
                  className="p-1 text-subtext0 hover:text-red cursor-pointer rounded-sm"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-2 bg-base/40 border border-surface1/60 text-[11px] text-subtext0 italic rounded-sm">
            No custom environment variables configured.
          </div>
        )}
      </div>

      {/* Form Action Buttons */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface1/60 rounded-sm">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 border border-surface1 hover:bg-surface1 text-subtext0 hover:text-text text-xs transition-colors cursor-pointer rounded-sm"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-1.5 bg-brand hover:bg-brand/90 text-on-accent text-xs font-semibold transition-colors cursor-pointer shadow-md shadow-brand/20 border border-brand flex items-center gap-1.5 rounded-sm"
        >
          <Check className="w-3.5 h-3.5 text-on-accent" />
          <span>{editingServerId ? 'Save Changes' : 'Register Server'}</span>
        </button>
      </div>
    </form>
  );
};

