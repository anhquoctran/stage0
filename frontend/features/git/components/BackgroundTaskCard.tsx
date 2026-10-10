import React from 'react';
import { Loader2 } from '../../../common/components/icons/Loader2';
import { AlertCircle } from '../../../common/components/icons/AlertCircle';
import { CheckCircle2 } from '../../../common/components/icons/CheckCircle2';
import { formatDateTime } from '../../../common/utils/dateTime';
import { useGitTaskStore } from '../store/useGitTaskStore';
import { useGitStore } from '../store/useGitStore';
import type { BackgroundTaskCardProps } from '../types/BackgroundTaskCardProps';
import { GitTaskProgress } from './GitTaskProgress';

export const BackgroundTaskCard: React.FC<BackgroundTaskCardProps> = ({ task }) => {
  const dismissTask = useGitTaskStore((state) => state.dismissTask);
  const isRunning = task.status === 'running';
  const openRepository = () => {
    if (!task.resultRepository) return;
    void useGitStore.getState().selectRepo(task.resultRepository);
    dismissTask(task.id);
  };

  return (
    <li className="space-y-3 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex min-w-0 items-center gap-2 text-xs font-semibold">
          {isRunning ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
            : task.status === 'failed' ? <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red" />
            : <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green" />}
          <span className="truncate">{task.title}</span>
        </h3>
        <span className={`text-[10px] ${task.status === 'failed' ? 'text-red' : 'text-subtext0'}`}>
          {isRunning ? 'Running' : task.status === 'failed' ? 'Failed' : 'Completed'}
        </span>
      </div>
      <GitTaskProgress task={task} />
      <div className="flex items-center justify-between gap-3">
        <time dateTime={new Date(task.startedAt).toISOString()} className="text-[10px] text-subtext0">
          {formatDateTime(task.startedAt)}
        </time>
        {!isRunning && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => dismissTask(task.id)} className="border border-surface1 px-2 py-1 text-[11px] hover:bg-surface0">
              Dismiss
            </button>
            {task.resultRepository && (
              <button type="button" onClick={openRepository} className="bg-primary px-2 py-1 text-[11px] font-semibold text-on-accent hover:brightness-110">
                Open repository
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
};
