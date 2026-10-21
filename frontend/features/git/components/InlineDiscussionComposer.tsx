import React, { useEffect, useRef, useState } from 'react';
import { MarkdownEditor } from '../../../common/components/MarkdownEditor';
import { useVirtualMrStore } from '../../virtual-mr/store/useVirtualMrStore';
import { useGitStore } from '../store/useGitStore';
import type { VirtualMrSession } from '../../virtual-mr/types/VirtualMrSession';
import type { DiscussionCodeSnippet } from '../../virtual-mr/types/DiscussionCodeSnippet';
import { getDiscussionMentionOptions } from '../../virtual-mr/utils/discussionMentions';
import { DiscussionCodeContext } from '../../virtual-mr/components/DiscussionCodeContext';

export const InlineDiscussionComposer: React.FC<{
  session: VirtualMrSession;
  filePath: string;
  side: 'left' | 'right';
  lineNumber: number;
  commitId: string;
  snippet: DiscussionCodeSnippet;
  initialBody?: string;
  onDraftChange?: (body: string) => void;
  onClose: () => void;
}> = ({
  session,
  filePath,
  side,
  lineNumber,
  commitId,
  snippet,
  initialBody = '',
  onDraftChange,
  onClose,
}) => {
  const { createDiscussion } = useVirtualMrStore();
  const { showToast } = useGitStore();
  const [body, setBody] = useState(initialBody);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitting = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const submit = async () => {
    if (!body.trim() || submitting.current) return;
    submitting.current = true;
    setIsSubmitting(true);
    try {
      // In Virtual MR, user comments are standard discussion comments, not reviews
      await createDiscussion(session.id, {
        filePath,
        diffSide: side,
        lineNumber,
        commitId,
        codeSnippet: snippet,
        initialComment: body.trim(),
        reviewAction: 'comment',
      });
      onDraftChange?.('');
      showToast('Comment posted', 'success');
      if (mounted.current) onClose();
    } catch (error) {
      showToast(`Could not post comment: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="space-y-2.5 border-y border-surface1 bg-mantle p-3.5 text-left font-sans text-text shadow-sm"
      onClick={(event) => event.stopPropagation()}
    >
      <DiscussionCodeContext discussion={{ filePath, diffSide: side, lineNumber, commitId, codeSnippet: snippet }} />

      <MarkdownEditor
        value={body}
        onChange={(value) => {
          setBody(value);
          onDraftChange?.(value);
        }}
        autoFocus
        rows={4}
        minHeight="100px"
        mentionOptions={getDiscussionMentionOptions(session)}
        placeholder="Write a comment or drag your files here…"
        showActions={false}
        onSubmit={submit}
        disabled={isSubmitting}
        isSubmitting={isSubmitting}
      />

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={submit}
          disabled={isSubmitting || !body.trim()}
          className="px-4 py-1.5 bg-blue hover:bg-blue/90 text-crust font-semibold text-xs shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
        >
          Add comment now
        </button>

        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="px-3.5 py-1.5 border border-surface1 bg-surface1 hover:bg-surface2 text-text text-xs font-medium transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
