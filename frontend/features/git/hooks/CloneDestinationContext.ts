import React from 'react';

export interface CloneDestinationContext {
  isCloneModalOpen: boolean;
  setErrorMessage: React.Dispatch<React.SetStateAction<string | null>>;
  pickCloneFolder: () => Promise<string | null>;
}
