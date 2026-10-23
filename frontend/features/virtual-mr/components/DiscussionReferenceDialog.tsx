import React, { useEffect, useRef } from 'react';
import { MarkdownPreview } from '../../../common/components/MarkdownPreview';
import { X } from '../../../common/components/icons/X';
import type { VirtualMrDiscussion } from '../types/VirtualMrDiscussion';
import type { VirtualMrComment } from '../types/VirtualMrComment';
import { getDiscussionComments } from '../utils/discussionReferences';

export const DiscussionReferenceDialog: React.FC<{
  discussion: VirtualMrDiscussion;
  comment?: VirtualMrComment;
  onClose: () => void;
}> = ({ discussion, comment, onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
      if (event.key === 'Tab' && dialogRef.current) {
        const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button, a[href]'));
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) {
          event.preventDefault(); first?.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      previousFocus?.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-6"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Quoted source" tabIndex={-1}
        className="max-h-[80vh] w-full max-w-2xl overflow-y-auto border border-surface1 bg-mantle p-4 text-text shadow-2xl rounded-sm">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">Quoted {comment ? 'comment' : 'discussion'}</h3>
            <p className="break-all font-mono text-[10px] text-subtext0">{comment?.id ?? discussion.id}</p>
            {discussion.filePath && <p className="mt-1 break-all text-xs text-subtext0">{discussion.filePath}{discussion.lineNumber ? `:${discussion.lineNumber}` : ''}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close quoted source" className="p-1 text-subtext0 hover:bg-surface0 hover:text-text rounded-sm">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          {(comment ? [comment] : getDiscussionComments(discussion)).map((item) => (
            <div key={item.id} className="border-l-2 border-surface1 pl-3">
              <p className="mb-1 text-xs font-medium">{item.authorName} <span className="break-all font-mono text-[10px] font-normal text-subtext0">{item.id}</span></p>
              <MarkdownPreview content={item.body} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
