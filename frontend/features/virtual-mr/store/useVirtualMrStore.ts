import { subscribeRepositorySettings } from '../services/repositorySettingsDocuments';
import { repoSettingsFromDocument } from '../utils/repoSettingsFromDocument';
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

subscribeRepositorySettings((repoId, doc) => {
  const state = useVirtualMrStore.getState();
  if (state.currentRepoId !== repoId) return;
  const labels = doc.labels.map((label) => ({ id: label.id, repoId, name: label.name,
    color: label.color, description: label.description || undefined }));
  useVirtualMrStore.setState({
    repoSettings: repoSettingsFromDocument(repoId, doc), repoLabels: labels,
    sessions: state.sessions.map((session) => ({ ...session,
      labels: session.labels.flatMap((label) => labels.find((item) => item.id === label.id) ?? []),
    })),
  });
});
