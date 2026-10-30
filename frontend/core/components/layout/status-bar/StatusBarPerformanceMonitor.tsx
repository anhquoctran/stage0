import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HeartPulse } from '../../../../common/components/icons/HeartPulse';
import { usePerformanceMonitorStore } from '../../../../features/performance/store/usePerformanceMonitorStore';
import { getPerformanceMetrics } from '../../../../features/performance/services/performanceService';
import type { PerformanceMetrics } from '../../../../features/performance/types/PerformanceMetrics';

function formatMemory(bytes: number): string {
  const mebibytes = bytes / (1024 * 1024);
  return mebibytes >= 1024
    ? `${(mebibytes / 1024).toFixed(1)} GB`
    : `${Math.round(mebibytes)} MB`;
}

function formatDetailedMemory(bytes: number): string {
  const mebibytes = bytes / (1024 * 1024);
  return mebibytes >= 1024
    ? `${(mebibytes / 1024).toFixed(2)} GB (${Math.round(mebibytes)} MB)`
    : `${mebibytes.toFixed(1)} MB`;
}

export const StatusBarPerformanceMonitor: React.FC = () => {
  const { t } = useTranslation();
  const isEnabled = usePerformanceMonitorStore((state) => state.isEnabled);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [performanceMetricsUnavailable, setPerformanceMetricsUnavailable] = useState(false);

  useEffect(() => {
    if (!isEnabled) {
      setPerformanceMetrics(null);
      setPerformanceMetricsUnavailable(false);
      return;
    }

    let disposed = false;
    let timer: number | undefined;
    const refreshMetrics = async () => {
      try {
        const metrics = await getPerformanceMetrics();
        if (!disposed) {
          setPerformanceMetrics(metrics);
          setPerformanceMetricsUnavailable(false);
        }
      } catch {
        if (!disposed) setPerformanceMetricsUnavailable(true);
      } finally {
        if (!disposed) timer = window.setTimeout(refreshMetrics, 5000);
      }
    };

    void refreshMetrics();
    return () => {
      disposed = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [isEnabled]);

  if (!isEnabled) return null;

  return (
    <div
      className="group relative flex h-5.5 items-center gap-2 border-s border-surface1/80 ps-2 text-[10px] text-subtext1 cursor-help focus-visible:outline-none rounded-sm"
      tabIndex={0}
      aria-label={t('common.performance.detailsLabel')}
      aria-describedby="performance-monitor-tooltip"
    >
      <HeartPulse className="h-3.5 w-3.5 text-primary shrink-0" />
      {performanceMetricsUnavailable ? (
        <span className="text-subtext0">{t('common.performance.unavailable')}</span>
      ) : (
        <>
          <span className="whitespace-nowrap">
            CPU{' '}
            <strong className="font-mono font-medium text-text">
              {performanceMetrics?.cpuPercent == null
                ? performanceMetrics
                  ? t('common.performance.measuring')
                  : '—'
                : `${performanceMetrics.cpuPercent.toFixed(1)}%`}
            </strong>
          </span>
          <span className="whitespace-nowrap">
            MEM{' '}
            <strong className="font-mono font-medium text-text">
              {performanceMetrics ? formatMemory(performanceMetrics.memoryBytes) : '—'}
            </strong>
          </span>
        </>
      )}

      <div
        id="performance-monitor-tooltip"
        role="tooltip"
        className="invisible absolute bottom-full end-0 z-50 mb-2 w-72 translate-y-1 border border-surface1 bg-mantle p-3 text-start text-xs text-text opacity-0 shadow-2xl transition-all duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 rounded-sm"
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <HeartPulse className="h-4 w-4 text-primary" />
            <span className="font-semibold">{t('common.performance.title')}</span>
          </div>
          <span className="bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-primary">
            {t('common.performance.live')}
          </span>
        </div>

        {performanceMetricsUnavailable ? (
          <p className="text-subtext1">{t('common.performance.readFailed')}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-surface0/70 p-2 rounded-sm">
                <div className="mb-1 text-[10px] text-subtext0">{t('common.performance.cpuUsage')}</div>
                <div className="font-mono text-sm font-semibold text-text">
                  {performanceMetrics?.cpuPercent == null
                    ? performanceMetrics
                      ? t('common.performance.measuring')
                      : '—'
                    : `${performanceMetrics.cpuPercent.toFixed(1)}%`}
                </div>
              </div>
              <div className="bg-surface0/70 p-2 rounded-sm">
                <div className="mb-1 text-[10px] text-subtext0">{t('common.performance.residentMemory')}</div>
                <div className="font-mono text-sm font-semibold text-text">
                  {performanceMetrics ? formatDetailedMemory(performanceMetrics.memoryBytes) : '—'}
                </div>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-subtext1">
              <span>{t('common.performance.processesTracked')}</span>
              <span className="font-mono text-text">{performanceMetrics?.processCount ?? '—'}</span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-3 text-[10px] text-subtext1">
              <span>{t('common.performance.refreshInterval')}</span>
              <span className="font-mono text-text">{t('common.performance.fiveSeconds')}</span>
            </div>
          </>
        )}

        <p className="mt-2 border-t border-surface0 pt-2 text-[10px] leading-relaxed text-subtext0">
          {t('common.performance.description')}
        </p>
      </div>
    </div>
  );
};

