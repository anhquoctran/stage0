import { clsx } from 'clsx';
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react';
import type { ScrollAreaProps } from '../types/ScrollAreaProps';

/** A vertical scroll surface with a transparent, idle-hiding overlay thumb. */
export function ScrollArea({ children, className, contentClassName, tabIndex = 0, ...props }: ScrollAreaProps) {
  return (
    <OverlayScrollbarsComponent
      {...props}
      className={clsx('stage0-scroll-area rounded-sm', className)}
      options={{
        overflow: { x: 'hidden', y: 'scroll' },
        scrollbars: {
          theme: 'os-theme-stage0',
          autoHide: 'scroll',
          autoHideDelay: 700,
          autoHideSuspend: false,
          dragScroll: true,
          clickScroll: 'instant',
        },
      }}
      events={{
        initialized: (instance) => { instance.elements().viewport.tabIndex = tabIndex; },
      }}
      defer
    >
      <div className={clsx('min-h-full rounded-sm', contentClassName)}>{children}</div>
    </OverlayScrollbarsComponent>
  );
}
