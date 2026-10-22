import React from 'react';
import { type BlameCommit } from '../../types/BlameCommit';

export interface BlameCommitDetailModalProps {
  commitModalRef: React.RefObject<HTMLDivElement | null>;
  setSelectedCommit: React.Dispatch<React.SetStateAction<BlameCommit | null>>;
  selectedCommit: BlameCommit;
  handleCopySha: (sha: string) => void;
  copiedSha: boolean;
  handleCopyCommitUrl: (sha: string) => void;
}
