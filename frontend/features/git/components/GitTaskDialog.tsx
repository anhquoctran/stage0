import React, { useEffect, useRef } from 'react';
import { CustomSelect } from '../../../common/components/CustomSelect';
import { X } from '../../../common/components/icons/X';
import { Loader2 } from '../../../common/components/icons/Loader2';
import { CheckCircle2 } from '../../../common/components/icons/CheckCircle2';
import { AlertCircle } from '../../../common/components/icons/AlertCircle';
import { useGitTaskStore } from '../store/useGitTaskStore';
import { useGitStore } from '../store/useGitStore';
import { GitTaskProgress } from './GitTaskProgress';

export const GitTaskDialog: React.FC = () => {
  const { tasks, selectedTaskId, runInBackground, dismissTask, showTask } = useGitTaskStore();
  const task = tasks.find((item) => item.id === selectedTaskId);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!selectedTaskId) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement : null;
    panelRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => {
      if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
    };
  }, [selectedTaskId]);

  if (!task) return null;
  const isRunning = task.status === 'running';
  const close = () => isRunning ? runInBackground(task.id) : dismissTask(task.id);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    event.stopPropagation();
    if (event.defaultPrevented) return;
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key === 'Tab') {
      const buttons = panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled)');
      const first = buttons?.[0];
      const last = buttons?.[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 top-8.5 z-[150] flex items-center justify-center bg-crust/60 p-4" onKeyDown={handleKeyDown}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="git-task-title" className="max-h-full w-full max-w-[420px] overflow-y-auto border border-surface1 bg-mantle text-text shadow-2xl">
        <div className="flex items-center justify-between border-b border-surface0 pl-4">
          <div className="flex min-w-0 items-center gap-2 py-3">
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin text-primary" />
              : task.status === 'failed' ? <AlertCircle className="h-4 w-4 text-red" />
              : <CheckCircle2 className="h-4 w-4 text-green" />}
            <h3 id="git-task-title" className="truncate text-sm font-semibold">{task.title}</h3>
          </div>
          <button type="button" onClick={close} aria-label={isRunning ? 'Run in background' : 'Dismiss task'} className="flex h-10 w-10 shrink-0 items-center justify-center text-subtext0 hover:bg-surface0 hover:text-text">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 p-4">
          {tasks.length > 1 && <CustomSelect value={task.id} onChange={showTask} options={tasks.map((item) => ({ value: item.id, label: `${item.title} · ${item.status}` }))} className="w-full" buttonClassName="w-full" dropdownWidth="w-full" align="left" aria-label="Git task" />}
          <GitTaskProgress task={task} />
          {isRunning && <p className="text-[11px] text-subtext0">You can continue working while this task runs in the background.</p>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-surface0 px-4 py-3">
          <button type="button" disabled={isRunning} title={isRunning ? 'Available when the task finishes. Use Run in background to hide progress.' : 'Dismiss this result'} onClick={() => dismissTask(task.id)} className="border border-surface1 px-3 py-1.5 text-xs hover:bg-surface0 disabled:cursor-not-allowed disabled:opacity-40">Dismiss</button>
          {isRunning ? <button type="button" onClick={() => runInBackground(task.id)} className="bg-primary px-3 py-1.5 text-xs font-semibold text-on-accent hover:brightness-110">Run in background</button>
            : task.resultRepository && <button type="button" onClick={() => { void useGitStore.getState().selectRepo(task.resultRepository!); dismissTask(task.id); }} className="bg-primary px-3 py-1.5 text-xs font-semibold text-on-accent hover:brightness-110">Open repository</button>}
        </div>
      </div>
    </div>
  );
};
