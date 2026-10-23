import React from 'react';
import type { ChangedFile } from '../../../git/types/ChangedFile';
import type { MrDiffPayload } from '../../../git/types/MrDiffPayload';
import type { ViewMode } from '../../../git/types/ViewMode';
import type { NewMrDraft } from '../../types/NewMrDraft';

export interface NewVirtualMrPreviewProps {
  setPreviewTab: React.Dispatch<React.SetStateAction<'commits' | 'diff'>>;
  previewTab: 'commits' | 'diff';
  draftMr: NewMrDraft;
  diffPayload: MrDiffPayload | null;
  changeDraftBranches: (base: string, compare: string) => Promise<void>;
  selectedFile: ChangedFile | null;
  selectFile: (file: ChangedFile | null) => void;
  isDiffLoading: boolean;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  openRepoDialog: (forceNewWindow?: boolean) => Promise<void>;
}
