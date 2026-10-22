import React from 'react';
import { type BlameCommit } from '../../types/BlameCommit';

export interface BlameLinesTableProps {
  fontFamily: string;
  fontSize: number;
  lineSpacing: number;
  filteredLines: {
    isNewBlock: boolean;
    commit: BlameCommit;
    originalIndex: number;
    line_no: number;
    orig_line_no: number;
    commit_id: string;
    content: string;
  }[];
  setSelectedCommit: React.Dispatch<React.SetStateAction<BlameCommit | null>>;
  enableLigatures: boolean;
}
