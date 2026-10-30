import { useTranslation as useUiTextTranslation } from 'react-i18next';
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
  const { t: translateUiText } = useUiTextTranslation();
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
    <div className="fixed inset-x-0 bottom-0 top-8.5 z-[150] flex items-center justify-center bg-crust/60 p-4 rounded-sm" onKeyDown={handleKeyDown}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="git-task-title" className="max-h-full w-full max-w-[420px] overflow-y-auto border border-surface1 bg-mantle text-text shadow-2xl">
        <div className="flex items-center justify-between border-b border-surface0 ps-4">
          <div className="flex min-w-0 items-center gap-2 py-3">
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin text-primary" />
              : task.status === 'failed' ? <AlertCircle className="h-4 w-4 text-red" />
              : <CheckCircle2 className="h-4 w-4 text-green" />}
            <h3 id="git-task-title" className="truncate text-sm font-semibold">{task.title}</h3>
          </div>
          <button type="button" onClick={close} aria-label={translateUiText(isRunning ? 'git.taskDialog.runInBackground' : 'git.taskDialog.dismissTask')} className="flex h-10 w-10 shrink-0 items-center justify-center text-subtext0 hover:bg-surface0 hover:text-text rounded-sm">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 p-4">
          {tasks.length > 1 && <CustomSelect value={task.id} onChange={showTask} options={tasks.map((item) => ({ value: item.id, label: translateUiText('git.taskDialog.taskOption', { title: item.title, status: translateUiText(`git.taskDialog.status.${item.status}`) }) }))} className="w-full" buttonClassName="w-full" dropdownWidth="w-full" align="left" aria-label={translateUiText('git.taskDialog.ariaLabel')} />}
          <GitTaskProgress task={task} />
          {isRunning && <p className="text-[11px] text-subtext0">{translateUiText('git.taskDialog.backgroundHint')}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-surface0 px-4 py-3 rounded-sm">
          <button type="button" disabled={isRunning} title={translateUiText(isRunning ? 'git.taskDialog.dismissUnavailableTitle' : 'git.taskDialog.dismissResultTitle')} onClick={() => dismissTask(task.id)} className="border border-surface1 px-3 py-1.5 text-xs hover:bg-surface0 disabled:cursor-not-allowed disabled:opacity-40 rounded-sm">{translateUiText('notifications.dismiss')}</button>
          {isRunning ? <button type="button" onClick={() => runInBackground(task.id)} className="bg-primary px-3 py-1.5 text-xs font-semibold text-on-accent hover:brightness-110 rounded-sm">{translateUiText('git.taskDialog.runInBackground')}</button>
            : task.resultRepository && <button type="button" onClick={() => { void useGitStore.getState().selectRepo(task.resultRepository!); dismissTask(task.id); }} className="bg-primary px-3 py-1.5 text-xs font-semibold text-on-accent hover:brightness-110 rounded-sm">{translateUiText('git.taskDialog.openRepository')}</button>}
        </div>
      </div>
    </div>
  );
};
