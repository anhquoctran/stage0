import type { GitOperationProgress } from '../types/GitOperationProgress';
import { useGitTaskStore } from '../store/useGitTaskStore';

export function createGitProgressHandler(taskId: string): (progress: GitOperationProgress) => void {
  return progress => useGitTaskStore.getState().updateTask(taskId, progress);
}
