import React, { useState } from 'react';
import { MCP_PRESET_TEMPLATES } from '../constants/aiPresets';
import type { AiMcpState } from '../types/AiMcpState';
import type { McpServerConfig } from '../types/McpServerConfig';
import type { McpServerType } from '../types/McpServerType';
import { isLikelySecretMcpEnvValue, isSecretMcpEnvName } from '../utils/listSecretMcpEnv';

export function useMcpServerForm({
  addMcpServer,
  updateMcpServer,
}: Pick<AiMcpState, 'addMcpServer' | 'updateMcpServer'>) {
  // Add / Edit Server Form State
  const [isServerFormOpen, setIsServerFormOpen] = useState(false);
  const [editingServerId, setEditingServerId] = useState<string | null>(null);
  const [serverName, setServerName] = useState('');
  const [serverDesc, setServerDesc] = useState('');
  const [serverType, setServerType] = useState<McpServerType>('stdio');
  const [serverCommand, setServerCommand] = useState('');
  const [serverArgsStr, setServerArgsStr] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [serverEnvPairs, setServerEnvPairs] = useState<
    Array<{ key: string; value: string; secretConfigured?: boolean; savedKey?: string }>
  >([]);
  const [formError, setFormError] = useState<string | null>(null);

  const handleOpenAddServer = (preset?: (typeof MCP_PRESET_TEMPLATES)[number]) => {
    setEditingServerId(null);
    setFormError(null);
    if (preset) {
      setServerName(preset.name);
      setServerDesc(preset.description);
      setServerType(preset.type);
      setServerCommand(preset.command);
      setServerArgsStr(preset.args.join(' '));
      setServerUrl(preset.url || '');
      setServerEnvPairs(Object.entries(preset.env).map(([k, v]) => ({ key: k, value: v })));
    } else {
      setServerName('');
      setServerDesc('');
      setServerType('stdio');
      setServerCommand('');
      setServerArgsStr('');
      setServerUrl('');
      setServerEnvPairs([]);
    }
    setIsServerFormOpen(true);
  };

  const handleOpenEditServer = (server: McpServerConfig) => {
    setEditingServerId(server.id);
    setFormError(null);
    setServerName(server.name);
    setServerDesc(server.description || '');
    setServerType(server.type);
    setServerCommand(server.command);
    setServerArgsStr(server.args.join(' '));
    setServerUrl(server.url || '');
    setServerEnvPairs([
      ...Object.entries(server.env).map(([key, value]) => ({ key, value })),
      ...(server.secretEnvKeys || [])
        .filter((key) => !(key in server.env))
        .map((key) => ({ key, value: '', secretConfigured: true, savedKey: key })),
    ]);
    setIsServerFormOpen(true);
  };

  const handleSaveServer = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!serverName.trim()) {
      setFormError('Server name is required');
      return;
    }

    if (serverType === 'stdio' && !serverCommand.trim()) {
      setFormError('Executable command is required for stdio transport (e.g. npx, uvx)');
      return;
    }

    if (serverType !== 'stdio' && !serverUrl.trim()) {
      setFormError('HTTP endpoint URL is required');
      return;
    }

    const parsedArgs = serverArgsStr
      .trim()
      .split(/\s+/)
      .filter((s) => s.length > 0);

    const envMap: Record<string, string> = {};
    const secretEnvKeys = new Set<string>();
    for (const pair of serverEnvPairs) {
      if (pair.key.trim()) {
        const key = pair.key.trim();
        const value = pair.value.trim();
        const keepsSavedSecret = pair.secretConfigured && pair.savedKey === key;
        const isSecret =
          keepsSavedSecret || isSecretMcpEnvName(key) || isLikelySecretMcpEnvValue(value);
        if (isSecret) {
          if (value) envMap[key] = value;
          if (value || keepsSavedSecret) secretEnvKeys.add(key);
        } else {
          envMap[key] = value;
        }
      }
    }

    if (editingServerId) {
      updateMcpServer(editingServerId, {
        name: serverName.trim(),
        description: serverDesc.trim() || undefined,
        type: serverType,
        command: serverCommand.trim(),
        args: parsedArgs,
        url: serverType !== 'stdio' ? serverUrl.trim() : undefined,
        env: envMap,
        secretEnvKeys: [...secretEnvKeys],
      });
    } else {
      addMcpServer({
        name: serverName.trim(),
        description: serverDesc.trim() || undefined,
        type: serverType,
        command: serverCommand.trim(),
        args: parsedArgs,
        url: serverType !== 'stdio' ? serverUrl.trim() : undefined,
        env: envMap,
        secretEnvKeys: [...secretEnvKeys],
        enabled: true,
      });
    }

    setIsServerFormOpen(false);
  };

  return {
    isServerFormOpen,
    setIsServerFormOpen,
    editingServerId,
    serverName,
    setServerName,
    serverDesc,
    setServerDesc,
    serverType,
    setServerType,
    serverCommand,
    setServerCommand,
    serverArgsStr,
    setServerArgsStr,
    serverUrl,
    setServerUrl,
    serverEnvPairs,
    setServerEnvPairs,
    formError,
    handleOpenAddServer,
    handleOpenEditServer,
    handleSaveServer,
  };
}
