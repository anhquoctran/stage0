import React from 'react';
import type { BotReviewer } from '../../types/BotReviewer';
import type { NewMrDraft } from '../../types/NewMrDraft';
import type { RepoLabel } from '../../types/RepoLabel';

export interface NewVirtualMrFormSectionProps {
  draftMr: NewMrDraft;
  updateDraftMr: (updates: Partial<NewMrDraft>) => void;
  handleGenerateDescription: () => void;
  effectiveReviewers: BotReviewer[];
  isLoadingReviewerOptions: boolean;
  showBotDropdown: boolean;
  setShowBotDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  toggleReviewerDropdown: () => Promise<void>;
  handleToggleBot: (botId: string) => void;
  handleRemoveBot: (botId: string) => void;
  botDropdownRef: React.RefObject<HTMLDivElement | null>;
  repoLabels: RepoLabel[];
  isLoadingLabelOptions: boolean;
  showLabelDropdown: boolean;
  setShowLabelDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  toggleLabelDropdown: () => Promise<void>;
  handleToggleLabel: (labelId: string) => void;
  handleRemoveLabel: (labelId: string) => void;
  labelSearch: string;
  setLabelSearch: React.Dispatch<React.SetStateAction<string>>;
  newLabelColor: string;
  setNewLabelColor: React.Dispatch<React.SetStateAction<string>>;
  handleCreateAndSelectLabel: () => Promise<void>;
  labelDropdownRef: React.RefObject<HTMLDivElement | null>;
  handleSubmit: (e?: React.FormEvent) => Promise<void>;
  isSubmitting: boolean;
  canCreateVirtualMr: boolean;
  closeNewMrDraft: () => void;
}
