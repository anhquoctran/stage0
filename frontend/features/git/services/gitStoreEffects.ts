import { getApplicationServices } from '../../../core/services/runtime/applicationRuntime';

import type { RepoInfo } from '../types/RepoInfo';

export const syncRecentRepositoriesMenu = async (repositories: RepoInfo[]): Promise<void> => {
  if (!getApplicationServices().platform.capabilities.menuUpdates) return;

  try {
    await getApplicationServices().application.updateRecentRepositoriesMenu({ repositories });
  } catch (error) {
    console.warn('Failed to update the native recent repositories menu:', error);
  }
};

export const getErrorMessage = (error: unknown): string => {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error) || String(error);
  } catch {
    return String(error);
  }
};

// Shared invalidation epoch: repository switches and diff requests must use the same counter.
export const gitDiffRequests = { version: 0 };
