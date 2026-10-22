import React from 'react';
import type { MrDiffPayload } from '../../../git/types/MrDiffPayload';
import type { NewMrDraft } from '../../types/NewMrDraft';

export interface NewVirtualMrPreviewToolbarProps {
  setPreviewTab: React.Dispatch<React.SetStateAction<'commits' | 'diff'>>;
  previewTab: 'commits' | 'diff';
  draftMr: NewMrDraft;
  diffPayload: MrDiffPayload | null;
}
