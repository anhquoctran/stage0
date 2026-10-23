import React from 'react';

export interface CustomGitBinaryFormProps {
  showAddCustom: boolean;
  setShowAddCustom: React.Dispatch<React.SetStateAction<boolean>>;
  setCustomError: React.Dispatch<React.SetStateAction<string | null>>;
  customPath: string;
  setCustomPath: React.Dispatch<React.SetStateAction<string>>;
  navigator: Navigator;
  handleBrowseCustom: () => Promise<void>;
  handleValidateAndAddCustom: () => Promise<void>;
  isValidatingCustom: boolean;
  customError: string | null;
}
