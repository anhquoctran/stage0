import React, { useLayoutEffect, useRef } from 'react';
import { useNotificationStore } from '../store/useNotificationStore';
import type { ToastContainerProps } from '../types/ToastContainerProps';
import { ToastItem } from './ToastItem';

const MAX_VISIBLE_TOASTS = 5;

export const ToastContainer: React.FC<ToastContainerProps> = ({ position, onHeightChange }) => {
  const { activeToasts, dismissToast } = useNotificationStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const visibleToasts = activeToasts.slice(0, MAX_VISIBLE_TOASTS);

  useLayoutEffect(() => {
    if (visibleToasts.length === 0) return;
    const element = containerRef.current;
    if (!element || !onHeightChange) return;

    // Measure the complete flow box. Visual effects such as box-shadow are
    // intentionally protected by the host buffer in NotificationHost.
    const reportSize = () => {
      const layoutHeight = Math.max(
        element.scrollHeight,
        element.getBoundingClientRect().height,
      );
      onHeightChange(Math.ceil(layoutHeight));
    };
    reportSize();
    const observer = new ResizeObserver(reportSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [visibleToasts.length, onHeightChange]);

  if (visibleToasts.length === 0) return null;

  const stacking = position === 'top-right' ? 'flex-col' : 'flex-col-reverse';

  return (
    <div
      ref={containerRef}
      aria-live="polite"
      className={`pointer-events-none flex ${stacking} w-[400px] max-w-screen gap-1.5 p-4 select-none`}
    >
      {visibleToasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  );
};
