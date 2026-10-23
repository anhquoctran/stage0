import React from 'react';

export interface PullAdvancedOptionsProps {
  useRebase: boolean;
  setUseRebase: React.Dispatch<React.SetStateAction<boolean>>;
  setUseFfOnly: React.Dispatch<React.SetStateAction<boolean>>;
  useAutostash: boolean;
  setUseAutostash: React.Dispatch<React.SetStateAction<boolean>>;
  useFfOnly: boolean;
  useNoCommit: boolean;
  setUseNoCommit: React.Dispatch<React.SetStateAction<boolean>>;
}
