import React from 'react';
import type { CustomSelectOption } from '../../../common/types/CustomSelectOption';
import { type GitCredentialProvider } from '../types/GitCredentialProvider';
import { type GitCredentialType } from '../types/GitCredentialType';

export interface AddGitCredentialModalProps {
  handleSave: (e: React.FormEvent) => Promise<void>;
  setIsAdding: React.Dispatch<React.SetStateAction<boolean>>;
  setFormError: React.Dispatch<React.SetStateAction<string | null>>;
  PROVIDER_PRESETS: {
    id: GitCredentialProvider;
    name: string;
    defaultUrl: string;
    defaultType: GitCredentialType;
  }[];
  handleProviderChange: (newProvider: GitCredentialProvider) => void;
  provider: GitCredentialProvider;
  serverUrl: string;
  setServerUrl: React.Dispatch<React.SetStateAction<string>>;
  accountName: string;
  setAccountName: React.Dispatch<React.SetStateAction<string>>;
  tokenType: GitCredentialType;
  CREDENTIAL_TYPE_OPTIONS: CustomSelectOption<GitCredentialType>[];
  setTokenType: React.Dispatch<React.SetStateAction<GitCredentialType>>;
  label: string;
  setLabel: React.Dispatch<React.SetStateAction<string>>;
  keyringName: string;
  showSecret: boolean;
  secret: string;
  setSecret: React.Dispatch<React.SetStateAction<string>>;
  setShowSecret: React.Dispatch<React.SetStateAction<boolean>>;
  isLoading: boolean;
}
