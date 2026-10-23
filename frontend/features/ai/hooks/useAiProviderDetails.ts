import { useState } from 'react';
import { type AiProviderId } from '../types/AiProviderId';
import type { AiProviderDetailsContext } from './AiProviderDetailsContext';

export function useAiProviderDetails({ aiConfig, setProvider }: AiProviderDetailsContext) {
  const [isProviderDetailsOpen, setIsProviderDetailsOpen] = useState(false);

  const [returnProviderAfterDetails, setReturnProviderAfterDetails] = useState<AiProviderId | null>(
    null
  );

  const openProviderDetails = (providerId: AiProviderId) => {
    setReturnProviderAfterDetails(providerId === aiConfig.provider ? null : aiConfig.provider);
    if (providerId !== aiConfig.provider) setProvider(providerId);
    setIsProviderDetailsOpen(true);
  };

  const closeProviderDetails = () => {
    const providerToRestore = returnProviderAfterDetails;
    setIsProviderDetailsOpen(false);
    setReturnProviderAfterDetails(null);
    if (providerToRestore && providerToRestore !== aiConfig.provider)
      setProvider(providerToRestore);
  };

  return { isProviderDetailsOpen, openProviderDetails, closeProviderDetails };
}
