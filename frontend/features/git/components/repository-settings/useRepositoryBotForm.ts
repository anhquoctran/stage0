import React, { useMemo, useState, type SetStateAction } from 'react';
import { useFormDraft } from '../../../../common/hooks/useFormDraft';
import type { RepositoryBotDraft } from '../../types/RepositoryBotDraft';
import type { RepositoryBotFormContext } from './RepositoryBotFormContext';

export function useRepositoryBotForm({
  currentRepoId,
  externalAgents,
  showToast,
  addRepoCustomReviewer,
}: RepositoryBotFormContext) {
  const [isAddingRepoBot, setIsAddingRepoBot] = useState(false);

  const { value: formDraft, setField } = useFormDraft<RepositoryBotDraft>(() => ({
    repoBotName: '',
    repoBotTagline: '',
    repoBotDesc: '',
    repoBotCategory: 'custom',
    repoBotEmoji: '🤖',
    repoBotInstructions: '',
    repoBotExecutionMode: 'provider',
    repoBotAcpAgentId: '',
    repoBotAllowAcpSourceTransfer: false,
    repoBotAcpConfigOptions: {},
  }));
  const {
    repoBotName,
    repoBotTagline,
    repoBotDesc,
    repoBotCategory,
    repoBotEmoji,
    repoBotInstructions,
    repoBotExecutionMode,
    repoBotAcpAgentId,
    repoBotAllowAcpSourceTransfer,
    repoBotAcpConfigOptions,
  } = formDraft;
  const {
    setRepoBotName,
    setRepoBotTagline,
    setRepoBotDesc,
    setRepoBotCategory,
    setRepoBotEmoji,
    setRepoBotInstructions,
    setRepoBotExecutionMode,
    setRepoBotAcpAgentId,
    setRepoBotAllowAcpSourceTransfer,
    setRepoBotAcpConfigOptions,
  } = useMemo(
    () => ({
      setRepoBotName: (next: SetStateAction<RepositoryBotDraft['repoBotName']>) =>
        setField('repoBotName', next),
      setRepoBotTagline: (next: SetStateAction<RepositoryBotDraft['repoBotTagline']>) =>
        setField('repoBotTagline', next),
      setRepoBotDesc: (next: SetStateAction<RepositoryBotDraft['repoBotDesc']>) =>
        setField('repoBotDesc', next),
      setRepoBotCategory: (next: SetStateAction<RepositoryBotDraft['repoBotCategory']>) =>
        setField('repoBotCategory', next),
      setRepoBotEmoji: (next: SetStateAction<RepositoryBotDraft['repoBotEmoji']>) =>
        setField('repoBotEmoji', next),
      setRepoBotInstructions: (next: SetStateAction<RepositoryBotDraft['repoBotInstructions']>) =>
        setField('repoBotInstructions', next),
      setRepoBotExecutionMode: (next: SetStateAction<RepositoryBotDraft['repoBotExecutionMode']>) =>
        setField('repoBotExecutionMode', next),
      setRepoBotAcpAgentId: (next: SetStateAction<RepositoryBotDraft['repoBotAcpAgentId']>) =>
        setField('repoBotAcpAgentId', next),
      setRepoBotAllowAcpSourceTransfer: (
        next: SetStateAction<RepositoryBotDraft['repoBotAllowAcpSourceTransfer']>
      ) => setField('repoBotAllowAcpSourceTransfer', next),
      setRepoBotAcpConfigOptions: (
        next: SetStateAction<RepositoryBotDraft['repoBotAcpConfigOptions']>
      ) => setField('repoBotAcpConfigOptions', next),
    }),
    [setField]
  );

  const handleSaveRepoCustomBot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoBotName.trim() || !currentRepoId) return;
    if (
      repoBotExecutionMode === 'acp' &&
      !externalAgents.some((agent) => agent.id === repoBotAcpAgentId)
    ) {
      showToast('Choose an installed ACP agent first.');
      return;
    }

    addRepoCustomReviewer(currentRepoId, {
      name: repoBotName.trim(),
      tagline: repoBotTagline.trim(),
      description: repoBotDesc.trim(),
      category: repoBotCategory,
      avatarEmoji: repoBotEmoji,
      customInstructions: repoBotInstructions.trim(),
      provider: repoBotExecutionMode === 'acp' ? 'global_default' : undefined,
      model: repoBotExecutionMode === 'acp' ? 'global_default' : undefined,
      acpAgentId: repoBotExecutionMode === 'acp' ? repoBotAcpAgentId : undefined,
      allowAcpSourceTransfer:
        repoBotExecutionMode === 'acp' ? repoBotAllowAcpSourceTransfer : undefined,
      acpConfigOptions: repoBotExecutionMode === 'acp' ? repoBotAcpConfigOptions : undefined,
      enabled: true,
      isBuiltin: false,
    });

    setIsAddingRepoBot(false);
    setRepoBotName('');
    setRepoBotTagline('');
    setRepoBotDesc('');
    setRepoBotCategory('custom');
    setRepoBotEmoji('🤖');
    setRepoBotInstructions('');
    setRepoBotExecutionMode('provider');
    setRepoBotAcpAgentId('');
    setRepoBotAllowAcpSourceTransfer(false);
    setRepoBotAcpConfigOptions({});
    showToast(`Added repo reviewer: ${repoBotName.trim()}`);
  };

  return {
    setIsAddingRepoBot,
    isAddingRepoBot,
    handleSaveRepoCustomBot,
    repoBotEmoji,
    setRepoBotEmoji,
    repoBotName,
    setRepoBotName,
    repoBotTagline,
    setRepoBotTagline,
    repoBotCategory,
    setRepoBotCategory,
    repoBotExecutionMode,
    setRepoBotExecutionMode,
    repoBotAcpAgentId,
    setRepoBotAcpAgentId,
    setRepoBotAcpConfigOptions,
    repoBotAcpConfigOptions,
    repoBotAllowAcpSourceTransfer,
    setRepoBotAllowAcpSourceTransfer,
    repoBotInstructions,
    setRepoBotInstructions,
  };
}
