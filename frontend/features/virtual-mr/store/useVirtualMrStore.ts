import { create } from 'zustand';
import type { VirtualMrState } from '../types/VirtualMrState';
import { createDiscussionSlice } from './createDiscussionSlice';
import { createDraftMrSlice } from './createDraftMrSlice';
import { createRepoSettingsSlice } from './createRepoSettingsSlice';
import { createSessionSlice } from './createSessionSlice';
import { createRepoDataSlice } from './slices/createRepoDataSlice';
import { createSessionCreationSlice } from './slices/createSessionCreationSlice';
import { createVirtualMrUiSlice } from './slices/createVirtualMrUiSlice';

export const useVirtualMrStore = create<VirtualMrState>((set, get, store) => ({
  ...createRepoDataSlice(set, get, store),
  ...createSessionCreationSlice(set, get, store),
  ...createVirtualMrUiSlice(set, get, store),
  ...createDraftMrSlice(set, get),
  ...createSessionSlice(set, get),
  ...createRepoSettingsSlice(set, get),
  ...createDiscussionSlice(set, get),
}));
