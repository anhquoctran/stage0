import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AcpAgentConfig } from '../types/AcpAgentConfig';
import type { CustomAcpAgentFormContext } from './CustomAcpAgentFormContext';

export function useCustomAcpAgentForm({
  setError,
  updateExternalAgents,
  externalAgents,
  setIsCustomOpen,
}: CustomAcpAgentFormContext) {
  const { t } = useTranslation();
  const [customName, setCustomName] = useState('');

  const [customCommand, setCustomCommand] = useState('');

  const [customArgs, setCustomArgs] = useState('');

  const addCustomAgent = (event: React.FormEvent) => {
    event.preventDefault();
    if (!customName.trim() || !customCommand.trim()) {
      setError(t('ai.externalAgents.nameCommandRequired'));
      return;
    }
    const config: AcpAgentConfig = {
      id: `custom-${Date.now()}`,
      name: customName.trim(),
      source: 'custom',
      command: customCommand.trim(),
      args: customArgs
        .split(/\r?\n/)
        .map((arg) => arg.trim())
        .filter(Boolean),
    };
    updateExternalAgents([...externalAgents, config]);
    setCustomName('');
    setCustomCommand('');
    setCustomArgs('');
    setIsCustomOpen(false);
    setError(null);
  };

  return {
    addCustomAgent,
    customName,
    setCustomName,
    customCommand,
    setCustomCommand,
    customArgs,
    setCustomArgs,
  };
}
