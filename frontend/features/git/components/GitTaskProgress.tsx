import React from 'react';
import type { GitTaskProgressProps } from '../types/GitTaskProgressProps';

export const GitTaskProgress: React.FC<GitTaskProgressProps> = ({ task }) => {
  const isRunning = task.status === 'running';
  return (
    <div className="space-y-3">
      <p className="truncate font-mono text-[11px] text-subtext0" title={task.repositoryPath}>
        {task.repositoryPath}
      </p>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="min-w-0 truncate">{task.phase}</span>
        <span className="shrink-0 font-mono text-subtext0">
          {task.progress !== null ? `${Math.round(task.progress)}%` : isRunning ? 'Working…' : ''}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${task.title}: ${task.phase}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={task.progress ?? undefined}
        className="h-1.5 overflow-hidden bg-surface0"
      >
        <div
          className={`h-full ${task.status === 'failed' ? 'bg-red' : 'bg-primary'} ${
            isRunning && task.progress === null ? 'git-task-indeterminate' : 'transition-[width] duration-200'
          }`}
          style={{ width: `${task.progress ?? (isRunning ? 30 : 0)}%` }}
        />
      </div>
      <p
        role={task.status === 'failed' ? 'alert' : 'status'}
        className={`max-h-24 overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed select-text ${
          task.status === 'failed' ? 'text-red' : 'text-subtext1'
        }`}
      >
        {task.error || task.message}
      </p>
    </div>
  );
};
