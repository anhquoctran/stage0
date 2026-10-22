import React from 'react';
import type { CustomSelectOption } from '../../../../common/types/CustomSelectOption';
import type { GitCredential } from '../../../credentials/types/GitCredential';

export interface CloneCredentialsSectionProps {
  useSavedCredential: boolean;
  isCloning: boolean;
  isSshRemote: boolean;
  setUseSavedCredential: React.Dispatch<React.SetStateAction<boolean>>;
  setErrorMessage: React.Dispatch<React.SetStateAction<string | null>>;
  selectedCredentialId: string;
  credentialsLoading: boolean;
  credentialOptions: GitCredential[];
  credentialSelectOptions: CustomSelectOption<string>[];
  setSelectedCredentialId: React.Dispatch<React.SetStateAction<string>>;
  remoteOrigin: string | null;
}
