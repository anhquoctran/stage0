import React from 'react';
import { X } from '../../../common/components/icons/X';

export function ExternalAgentsModal({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-2xl border border-surface2 bg-mantle text-text shadow-2xl">
        <header className="flex items-center justify-between border-b border-surface1 px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="border border-transparent p-1 text-subtext0 hover:border-surface2 hover:text-text cursor-pointer rounded-sm"><X className="h-4 w-4" /></button>
        </header>
        <div className="max-h-[75vh] overflow-y-auto p-4">{children}</div>
      </section>
    </div>
  );
}

