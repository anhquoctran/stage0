import React from 'react';
import type { GitBinaryInfo } from '../../types/GitBinaryInfo';

export interface GitBinaryDetectionCardProps {
  committedBinary: GitBinaryInfo;
  getSourceBadge: (source: string) => React.JSX.Element;
  handleCopyPath: (path: string, e: React.MouseEvent) => void;
  copiedPath: string | null;
}
