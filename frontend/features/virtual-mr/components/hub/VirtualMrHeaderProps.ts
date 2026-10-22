import React from 'react';
import type { BranchList } from '../../../git/types/BranchList';
import type { ReviewBatchProgress } from '../../../review/types/ReviewBatchProgress';
import type { VirtualMrSession } from '../../types/VirtualMrSession';

export interface VirtualMrHeaderProps {
  session: VirtualMrSession;
  sequenceNumber: number;
  isEditingTitle: boolean;
  editTitle: string;
  setEditTitle: React.Dispatch<React.SetStateAction<string>>;
  handleSaveTitle: () => Promise<void>;
  setIsEditingTitle: React.Dispatch<React.SetStateAction<boolean>>;
  handleStartEditTitle: () => void;
  isBranchLocked: boolean;
  branchLockedReason: 'Cannot change branches once discussions or reviews have started in this Virtual MR';
  branches: BranchList | null;
  handleBranchChange: (sessionId: string, newBase: string, newCompare: string) => Promise<void>;
  handleSwapBranches: (
    sessionId: string,
    currentBase: string,
    currentCompare: string
  ) => Promise<void>;
  hasAssignedReviewer: boolean;
  reviewBatch: ReviewBatchProgress;
  reviewIsStarting: boolean;
  reviewIsRunning: boolean;
  handleStartAiReview: () => Promise<void>;
}
