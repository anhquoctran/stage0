import React from 'react';

export interface GitCredentialsVaultBannerProps {
  isAdding: boolean;
  setIsAdding: React.Dispatch<React.SetStateAction<boolean>>;
  clearError: () => void;
  setFormError: React.Dispatch<React.SetStateAction<string | null>>;
}
