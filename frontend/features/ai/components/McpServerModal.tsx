import { useTranslation as useUiTextTranslation } from 'react-i18next';
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
  const { t: translateUiText } = useUiTextTranslation();
  if (!isOpen) return null;
  const serverTypeOptions: CustomSelectOption<McpServerType>[] = [
    { value: 'stdio', label: translateUiText('ai.mcpServerForm.stdioOption') },
    { value: 'http', label: translateUiText('ai.mcpServerForm.httpOption') },
    { value: 'sse', label: translateUiText('ai.mcpServerForm.sseOption') },
  ];

  return (
    <form
      onSubmit={onSave}
      className="p-4 bg-surface0/60 border border-surface1 space-y-4 animate-in fade-in zoom-in-98 duration-150"
    >
      <div className="flex items-center justify-between pb-2 border-b border-surface1/60">
        <span className="text-xs font-bold text-text flex items-center gap-1.5">
          <Cable className="w-3.5 h-3.5 text-subtext0" />
          {editingServerId ? translateUiText('ai.mcpServerForm.editTitle') : translateUiText('ai.mcpServerForm.addTitle')}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-subtext0 hover:text-text cursor-pointer rounded-sm"
          aria-label={translateUiText('common.close')}
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
            {translateUiText('ai.mcpServerForm.serverName')} <span className="text-red">*</span>
          </label>
          <input
            type="text"
            value={serverName}
            onChange={(e) => setServerName(e.target.value)}
            placeholder={translateUiText('ai.mcpServerForm.serverNamePlaceholder')}
            required
            className="w-full px-3 py-1.5 bg-base border border-surface1 text-xs text-text placeholder:text-subtext0 focus:outline-none focus:border-surface2 rounded-sm"
          />
        </div>

        {/* Transport Type */}
        <div>
          <label className="block text-[11px] font-medium text-subtext0 mb-1">
            {translateUiText('ai.mcpServerForm.transportProtocol')}
          </label>
          <CustomSelect
            value={serverType}
            options={serverTypeOptions}
            onChange={setServerType}
            className="w-full"
            buttonClassName="w-full"
            dropdownWidth="w-full"
            align="left"
            aria-label={translateUiText('ai.mcpServerForm.transportProtocol')}
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-[11px] font-medium text-subtext0 mb-1">
          {translateUiText('ai.mcpServerForm.description')} <span className="text-subtext0/60 font-normal">({translateUiText('common.optional')})</span>
        </label>
        <input
          type="text"
          value={serverDesc}
          onChange={(e) => setServerDesc(e.target.value)}
          placeholder={translateUiText('ai.mcpServerForm.descriptionPlaceholder')}
          className="w-full px-3 py-1.5 bg-base border border-surface1 text-xs text-text placeholder:text-subtext0 focus:outline-none focus:border-surface2 rounded-sm"
        />
      </div>

      {/* Stdio Commands & Args */}
      {serverType === 'stdio' ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-subtext0 mb-1">
                {translateUiText('ai.mcpServerForm.executableCommand')} <span className="text-red">*</span>
              </label>
              <div className="relative flex items-center">
                <Terminal className="w-3.5 h-3.5 text-subtext0 absolute start-2.5" />
                <input
                  type="text"
                  value={serverCommand}
                  onChange={(e) => setServerCommand(e.target.value)}
                  placeholder="npx, uvx, docker, python"
                  required
                  className="w-full ps-8 pe-3 py-1.5 bg-base border border-surface1 text-xs text-text font-mono placeholder:text-subtext0 focus:outline-none focus:border-surface2 rounded-sm"
                />
              </div>
            </div>

            <div className="col-span-2">
              <label className="block text-[11px] font-medium text-subtext0 mb-1">
                {translateUiText('ai.mcpServerForm.argumentsSpaceSeparated')}
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
            {serverType === 'http' ? translateUiText('ai.mcpServerForm.httpEndpoint') : translateUiText('ai.mcpServerForm.sseEndpoint')} <span className="text-red">*</span>
          </label>
          <div className="relative flex items-center">
            <Globe className="w-3.5 h-3.5 text-subtext0 absolute start-2.5" />
            <input
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder={serverType === 'http' ? 'http://localhost:8000/mcp' : 'http://localhost:8000/sse'}
              required
              className="w-full ps-8 pe-3 py-1.5 bg-base border border-surface1 text-xs text-text font-mono placeholder:text-subtext0 focus:outline-none focus:border-surface2 rounded-sm"
            />
          </div>
        </div>
      )}

      {/* Environment Variables (Key-Value) */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] font-medium text-subtext0">
            {translateUiText('ai.mcpServerForm.environmentVariables')}
          </label>
          <button
            type="button"
            onClick={() =>
              setServerEnvPairs([...serverEnvPairs, { key: '', value: '' }])
            }
            className="flex items-center gap-1 text-[10px] text-subtext0 hover:text-text px-2 py-0.5 hover:bg-surface1 transition-colors cursor-pointer rounded-sm"
          >
            <Plus className="w-3 h-3" />
            <span>{translateUiText('ai.mcpServerForm.addVariable')}</span>
          </button>
        </div>

        <p className="text-[10px] text-subtext0 mb-2">
          {translateUiText('ai.mcpServerForm.secretExplanation')}
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
                  placeholder={pair.secretConfigured && pair.savedKey === pair.key ? translateUiText('ai.mcpServerForm.savedSecretPlaceholder') : 'value'}
                  className="flex-1 px-2.5 py-1 bg-base border border-surface1 text-xs text-text font-mono placeholder:text-subtext0 focus:outline-none rounded-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    setServerEnvPairs(serverEnvPairs.filter((_, i) => i !== idx));
                  }}
                  className="p-1 text-subtext0 hover:text-red cursor-pointer rounded-sm"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="sr-only">{translateUiText('ai.mcpServerForm.removeVariable')}</span>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-2 bg-base/40 border border-surface1/60 text-[11px] text-subtext0 italic rounded-sm">
            {translateUiText('ai.mcpServerForm.noCustomEnvironmentVariables')}
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
          {translateUiText('common.cancel')}
        </button>
        <button
          type="submit"
          className="px-4 py-1.5 bg-brand hover:bg-brand/90 text-on-accent text-xs font-semibold transition-colors cursor-pointer shadow-md shadow-brand/20 border border-brand flex items-center gap-1.5 rounded-sm"
        >
          <Check className="w-3.5 h-3.5 text-on-accent" />
          <span>{editingServerId ? translateUiText('ai.mcpServerForm.saveChanges') : translateUiText('ai.mcpServerForm.registerServer')}</span>
        </button>
      </div>
    </form>
  );
};

