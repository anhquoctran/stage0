import React from 'react';
import type { BranchList } from '../../types/BranchList';
import type { FileBlamePayload } from '../../types/FileBlamePayload';

export interface BlameToolbarProps {
  revisionDropdownRef: React.RefObject<HTMLDivElement | null>;
  setIsRevisionDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isRevisionDropdownOpen: boolean;
  blameRevision: string;
  compareBranch: string;
  setBlameRevision: (rev: string) => void;
  baseBranch: string;
  branches: BranchList | null;
  blameIgnoreWhitespace: boolean;
  setBlameIgnoreWhitespace: (ignore: boolean) => void;
  fetchFileBlame: (
    filePath?: string,
    revision?: string,
    ignoreWhitespace?: boolean
  ) => Promise<void>;
  isBlameLoading: boolean;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  blamePayload: FileBlamePayload | null;
  statsDropdownRef: React.RefObject<HTMLDivElement | null>;
  setIsStatsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isStatsOpen: boolean;
}
