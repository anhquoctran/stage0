import React from 'react';
import type { AcpAgentConfig, AcpRegistryAgent } from '../../types/AcpAgentConfig';
import type { AuthMethod } from '../../types/AuthMethod';
import { type AcpLastSuccessfulSignIn } from '../../utils/acpAuthHistory';

export interface AcpAgentDetailsProps {
  project: {
    detailAgent: AcpAgentConfig;
    detailRegistryEntry: AcpRegistryAgent | null;
    projectLicenseUrl: string | undefined;
    registryDistribution: (entry: AcpRegistryAgent) => string;
    reportedAgentInfo: { name?: string; title?: string; version?: string } | null;
    projectWebsiteUrl: string | undefined;
    projectRepositoryUrl: string | undefined;
  };
  dialog: {
    setDetailAgent: React.Dispatch<React.SetStateAction<AcpAgentConfig | null>>;
    setDetailRegistryEntry: React.Dispatch<React.SetStateAction<AcpRegistryAgent | null>>;
    error: string | null;
    notice: string | null;
    setRemovePending: React.Dispatch<React.SetStateAction<boolean>>;
    removePending: boolean;
    removeAgent: () => void;
  };
  account: {
    authStatus: {
      kind: string;
      label: string;
      detail?: string;
      account?: { email?: string; organization?: string; plan?: string };
    } | null;
    lastSuccessfulSignIn: AcpLastSuccessfulSignIn | null;
    isCheckingAuth: boolean;
    supportsAuthStatus: boolean;
    supportsAuthLogout: boolean;
    authMethods: AuthMethod[];
    selectedAuthMethod: string;
    setSelectedAuthMethod: React.Dispatch<React.SetStateAction<string>>;
    busyId: string | null;
    isProtocolAuthMethod: (method?: AuthMethod) => boolean;
    selectedAuthOption: AuthMethod | undefined;
    signIn: () => Promise<void>;
  };
  promptSession: {
    currentRepoPath: string | null;
    prompt: string;
    setPrompt: React.Dispatch<React.SetStateAction<string>>;
    isSendingPrompt: boolean;
    sendPrompt: () => Promise<void>;
    response: string;
  };
}
