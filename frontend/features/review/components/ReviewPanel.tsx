import { useTranslation as useUiTextTranslation } from 'react-i18next';
import React, { useEffect, useRef } from 'react';
import { CustomSelect } from '../../../common/components/CustomSelect';
import { X } from '../../../common/components/icons/X';
import { formatDateTime } from '../../../common/utils/dateTime';
import { useDateTimeLanguage } from '../../i18n/hooks/useDateTimeLanguage';
import { useVirtualMrStore } from '../../virtual-mr/store/useVirtualMrStore';
import { useReviewStore } from '../store/useReviewStore';
import { HarnessConnectionsPanel } from './HarnessConnectionsPanel';
import { ReviewConfigurationSection } from './ReviewConfigurationSection';
import { ReviewFindingCard } from './ReviewFindingCard';
import { ReviewRunSummary } from './ReviewRunSummary';

export const ReviewPanel: React.FC = () => {
  const { t: translateUiText } = useUiTextTranslation();
  useDateTimeLanguage();
  const {
    isOpen,
    sessionId,
    runs,
    detail,
    error,
    isPublishing,
    activeRuns,
    syncActive,
    close,
    load,
    cancel,
    publish,
  } = useReviewStore();
  const session = useVirtualMrStore(
    (state) => state.sessions.find((item) => item.id === sessionId) || null
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const run = detail?.run;
  const running = run?.status === 'running';
  const activeIds = Object.keys(activeRuns).sort().join(',');
  useEffect(() => {
    if (!sessionId || !isOpen) return;
    void load(sessionId);
  }, [sessionId, isOpen, load]);
  useEffect(() => {
    if (!activeIds) return;
    const timer = setInterval(() => void syncActive(), 1500);
    return () => clearInterval(timer);
  }, [activeIds, syncActive]);
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement;
    panelRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-x-0 top-8.5 bottom-0 z-[140] bg-crust/75 p-4 flex items-center justify-center rounded-sm"
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Escape') {
          event.preventDefault();
          close();
        }
        if (event.key === 'Tab') {
          const elements = panelRef.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled),[tabindex="0"]'
          );
          const first = elements?.[0];
          const last = elements?.[elements.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-panel-title"
        className="w-full max-w-5xl max-h-full bg-mantle border border-surface1 shadow-2xl flex flex-col text-text rounded-sm overflow-hidden"
      >
        <header className="flex items-center justify-between border-b border-surface0 ps-5 shrink-0 rounded-t-sm">
          <h2 id="review-panel-title" className="text-sm font-semibold">
            {translateUiText('notifications.aiReviewTitle')}
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label={translateUiText('review.panel.close')}
            title={translateUiText('review.panel.closeTitle')}
            className="w-12 h-12 grid place-items-center hover:bg-surface0 rounded-sm"
          >
            <X className="w-5 h-5" />
          </button>
        </header>
        <div className="min-h-0 overflow-y-auto p-5 space-y-4">
          <ReviewConfigurationSection
            session={session}
            close={close}
            running={running}
            cancel={cancel}
          />
          {error && (
            <p
              role="alert"
              className="border border-red/40 p-3 text-xs text-red whitespace-pre-wrap"
            >
              {error}
            </p>
          )}
          <HarnessConnectionsPanel />
          {runs.length > 0 && (
            <CustomSelect
              value={run?.id || runs[0].id}
              onChange={(id) => sessionId && void load(sessionId, id)}
              options={runs.map((item) => ({
                value: item.id,
                label: `${formatDateTime(item.startedAt)} · ${item.reviewerName ? `${item.reviewerName} · ` : ''}${translateUiText(`review.runSummary.status.${item.status}`)} · ${item.model}`,
              }))}
              aria-label={translateUiText('review.panel.runHistory')}
              className="w-full"
              buttonClassName="w-full"
              dropdownWidth="w-full"
              align="left"
            />
          )}
          {!run && (
            <p className="text-xs text-subtext0">
              {translateUiText('review.panel.noRunSelected')}
            </p>
          )}
          {run && (
            <>
              <ReviewRunSummary run={run} isPublishing={isPublishing} publish={publish} />
              <div className="space-y-3">
                {run.findings.map((finding, index) => (
                  <ReviewFindingCard key={`${run.id}-${index}`} finding={finding} />
                ))}
              </div>
              {detail.events.length > 0 && (
                <details className="text-xs">
                  <summary>{translateUiText('review.panel.runTrace')}</summary>
                  <ol className="mt-2 space-y-1 max-h-40 overflow-auto font-mono text-[11px] text-subtext0">
                    {detail.events.map((event) => (
                      <li key={event.seq}>
                        {event.kind} · {JSON.stringify(event.detail)}
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
