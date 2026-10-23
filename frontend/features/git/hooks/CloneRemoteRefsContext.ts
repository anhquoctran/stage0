import React from 'react';
import type { CloneOptions } from '../types/CloneOptions';

export interface CloneRemoteRefsContext {
  setCloneOptions: React.Dispatch<React.SetStateAction<CloneOptions>>;
  remoteUrl: string;
  isCloneModalOpen: boolean;
  useSavedCredential: boolean;
  hasSelectedCredential: boolean;
  selectedCredentialId: string;
}
