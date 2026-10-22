import React from 'react';
import type { VirtualMrSession } from '../../types/VirtualMrSession';

export interface VirtualMrOverviewTabProps {
  isEditingDesc: boolean;
  setIsEditingDesc: React.Dispatch<React.SetStateAction<boolean>>;
  session: VirtualMrSession;
  descValue: string;
  setDescValue: React.Dispatch<React.SetStateAction<string>>;
  handleGenerateDescription: () => void;
  handleSaveDesc: () => Promise<void>;
  newGeneralComment: string;
  setNewGeneralComment: React.Dispatch<React.SetStateAction<string>>;
  handleAddGeneralComment: () => Promise<void>;
  isPostingDiscussion: boolean;
}
