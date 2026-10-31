import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { List } from '../../../common/components/icons/List';
import { Loader2 } from '../../../common/components/icons/Loader2';
import { X } from '../../../common/components/icons/X';
import { useNotificationStore } from '../../notifications/store/useNotificationStore';
import { useGitTaskStore } from '../store/useGitTaskStore';
import { BackgroundTaskCard } from './BackgroundTaskCard';

export const BackgroundTaskManager: React.FC = () => {
  const { t } = useTranslation();
  const { tasks, isBackgroundManagerOpen, setBackgroundManagerOpen } = useGitTaskStore();
  const backgroundTasks = tasks.filter((task) => task.background);
  const runningCount = backgroundTasks.filter((task) => task.status === 'running').length;
  const failedCount = backgroundTasks.filter((task) => task.status === 'failed').length;
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isBackgroundManagerOpen) return;
    // These two status-bar panels share the same corner of the viewport.
    useNotificationStore.getState().setHistoryDrawerOpen(false);
    closeRef.current?.focus();
    const handleOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) {
        setBackgroundManagerOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, [isBackgroundManagerOpen, setBackgroundManagerOpen]);

  const close = () => {
    setBackgroundManagerOpen(false);
    triggerRef.current?.focus();
  };
  const status = runningCount > 0 ? t('git.backgroundTasks.running')
    : failedCount > 0 ? t('git.backgroundTasks.failed')
    : t('git.backgroundTasks.completed');
  const label = t('git.backgroundTasks.summary', { count: runningCount || failedCount || backgroundTasks.length, status });

  return (
    <div ref={containerRef} className="relative shrink-0" onKeyDown={(event) => {
      if (!isBackgroundManagerOpen) return;
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); close(); }
    }}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={backgroundTasks.length ? label : t('git.backgroundTasks.title')}
        aria-haspopup="dialog"
        aria-expanded={isBackgroundManagerOpen}
        aria-controls="background-task-manager"
        title={backgroundTasks.length ? label : t('git.backgroundTasks.title')}
        onClick={() => setBackgroundManagerOpen(!isBackgroundManagerOpen)}
        className={`relative flex h-6 min-w-7 items-center justify-center gap-1 px-1.5 transition-colors cursor-pointer rounded-sm ${
          isBackgroundManagerOpen ? 'bg-surface1 text-text' : 'text-subtext0 hover:bg-surface0 hover:text-text'
        }`}
      >
        {runningCount > 0 ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> : <List className="h-3.5 w-3.5" />}
        {backgroundTasks.length > 0 && (
          <span className={`font-mono text-[10px] ${failedCount > 0 ? 'text-red' : 'text-primary'}`}>
            {runningCount || backgroundTasks.length}
          </span>
        )}
      </button>

      {isBackgroundManagerOpen && (
        <section
          id="background-task-manager"
          role="dialog"
          aria-modal="false"
          aria-labelledby="background-task-manager-title"
          className="absolute bottom-full end-0 z-50 mb-2 flex max-h-[calc(100dvh-5rem)] w-[min(420px,calc(100vw-2rem))] flex-col border border-surface1 bg-mantle text-start text-text shadow-2xl rounded-sm overflow-hidden"
        >
          <header className="flex shrink-0 items-center justify-between border-b border-surface0 ps-4 rounded-t-sm">
            <div className="flex items-center gap-2">
              <h2 id="background-task-manager-title" className="text-xs font-semibold">{t('git.backgroundTasks.title')}</h2>
              {runningCount > 0 && <span className="text-[10px] text-primary">{t('git.backgroundTasks.runningCount', { count: runningCount })}</span>}
            </div>
            <button ref={closeRef} type="button" onClick={close} aria-label={t('git.backgroundTasks.close')} className="grid h-9 w-9 place-items-center text-subtext0 hover:bg-surface0 hover:text-text rounded-sm">
              <X className="h-4 w-4" />
            </button>
          </header>
          {backgroundTasks.length ? (
            <ul className="min-h-0 overflow-y-auto overscroll-contain divide-y divide-surface0">
              {backgroundTasks.map((task) => <BackgroundTaskCard key={task.id} task={task} />)}
            </ul>
          ) : (
            <p className="px-4 py-8 text-center text-xs text-subtext0">{t('git.backgroundTasks.empty')}</p>
          )}
        </section>
      )}
    </div>
  );
};
