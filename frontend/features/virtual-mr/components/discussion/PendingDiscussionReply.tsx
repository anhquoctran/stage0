import { Bot } from '../../../../common/components/icons/Bot';
import { AiBotBadge } from '../AiBotBadge';

export function PendingDiscussionReply({ authorName, label }: { authorName: string; label: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-2 rounded-sm border border-brand/30 bg-brand/5 p-3">
      <div className="flex items-center gap-2 text-xs">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-brand/15 text-brand">
          <Bot className="h-3.5 w-3.5" />
        </span>
        <span className="font-semibold text-text">{authorName.replace(/^Stage0 AI \((.*)\)$/, '$1')}</span>
        <AiBotBadge />
        <span className="text-subtext0">reviewing now</span>
      </div>
      <p className="text-xs text-subtext1">{label}</p>
      <div className="space-y-1.5 animate-pulse" aria-hidden="true">
        <div className="h-2.5 w-4/5 rounded-sm bg-surface1/80" />
        <div className="h-2.5 w-full rounded-sm bg-surface1/70" />
        <div className="h-2.5 w-2/3 rounded-sm bg-surface1/60" />
      </div>
    </div>
  );
}
