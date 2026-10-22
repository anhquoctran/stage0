import React from 'react';
import type { GitCredential } from '../types/GitCredential';

export interface GitCredentialCardProps {
  cred: GitCredential;
  handleVerify: (id: string) => Promise<void>;
  verifyingId: string | null;
  deletingId: string | null;
  handleConfirmDelete: (id: string) => Promise<void>;
  setDeletingId: React.Dispatch<React.SetStateAction<string | null>>;
  handleCopyTokenRef: (tokenRef: string, id: string) => void;
  copiedId: string | null;
}
