import React from 'react';
import type { MrDiffPayload } from '../../../git/types/MrDiffPayload';
import { type BotReviewer } from '../../types/BotReviewer';
import type { RepoLabel } from '../../types/RepoLabel';
import type { VirtualMrSession } from '../../types/VirtualMrSession';

export interface VirtualMrMetadataBarProps {
  session: VirtualMrSession;
  removeReviewerBot: (sessionId: string, agentId: string) => Promise<void>;
  toggleReviewerDropdown: () => Promise<void>;
  showReviewerDropdown: boolean;
  isLoadingReviewerOptions: boolean;
  effectiveReviewers: BotReviewer[];
  assignReviewerBot: (sessionId: string, botId: string) => Promise<void>;
  setShowReviewerDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  toggleLabelDropdown: () => Promise<void>;
  showLabelDropdown: boolean;
  setShowLabelDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  openRepoSettings: (tab?: 'remotes' | 'branches' | 'labels' | 'agents') => void;
  isLoadingLabelOptions: boolean;
  repoLabels: RepoLabel[];
  toggleSessionLabel: (sessionId: string, labelId: string) => Promise<void>;
  setActiveMrTab: (tab: 'overview' | 'commits' | 'diff') => void;
  activeMrTab: 'overview' | 'commits' | 'diff';
  diffPayload: MrDiffPayload | null;
}
