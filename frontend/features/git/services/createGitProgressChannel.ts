import { Channel } from '@tauri-apps/api/core';
import type { GitOperationProgress } from '../types/GitOperationProgress';
import { useGitTaskStore } from '../store/useGitTaskStore';

export function createGitProgressChannel(taskId: string): Channel<GitOperationProgress> {
  return new Channel<GitOperationProgress>((progress) => {
    useGitTaskStore.getState().updateTask(taskId, progress);
  });
}
