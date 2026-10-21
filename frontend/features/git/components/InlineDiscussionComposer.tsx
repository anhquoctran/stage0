import React, { useEffect, useRef, useState } from 'react';
import { MarkdownEditor } from '../../../common/components/MarkdownEditor';
import { CustomSelect } from '../../../common/components/CustomSelect';
import { useVirtualMrStore } from '../../virtual-mr/store/useVirtualMrStore';
import { useGitStore } from '../store/useGitStore';
import type { VirtualMrSession } from '../../virtual-mr/types/VirtualMrSession';
import type { DiscussionCodeSnippet } from '../../virtual-mr/types/DiscussionCodeSnippet';
import { getDiscussionMentionOptions } from '../../virtual-mr/utils/discussionMentions';
import { DiscussionCodeContext } from '../../virtual-mr/components/DiscussionCodeContext';
import type { ReviewActionType } from '../../virtual-mr/types/ReviewActionType';

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
}> = ({ session, filePath, side, lineNumber, commitId, snippet, initialBody = '', onDraftChange, onClose }) => {
  const { createDiscussion } = useVirtualMrStore();
  const { showToast } = useGitStore();
  const [body, setBody] = useState(initialBody);
  const [reviewAction, setReviewAction] = useState<ReviewActionType>('comment');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const submit = async () => {
    if (!body.trim() || submitting.current) return;
    submitting.current = true; setIsSubmitting(true);
    try {
      await createDiscussion(session.id, { filePath, diffSide: side, lineNumber, commitId, codeSnippet: snippet, initialComment: body.trim(), reviewAction });
      onDraftChange?.('');
      showToast('Discussion posted', 'success');
      if (mounted.current) onClose();
    } catch (error) {
      showToast(`Could not post discussion: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally { submitting.current = false; setIsSubmitting(false); }
  };
  return (
    <div className="space-y-2 border-y border-brand/30 bg-mantle p-3 text-left font-sans text-text" onClick={(event) => event.stopPropagation()}>
      <p className="text-xs font-semibold">Start a discussion</p>
      <CustomSelect<ReviewActionType> value={reviewAction} onChange={setReviewAction} disabled={isSubmitting}
        options={[{ value: 'comment', label: 'Comment' }, { value: 'request_changes', label: 'Request changes' }]}
        aria-label="Line review action" align="left" dropdownWidth="w-44" />
      <DiscussionCodeContext discussion={{ filePath, diffSide: side, lineNumber, commitId, codeSnippet: snippet }} />
      <MarkdownEditor value={body} onChange={(value) => { setBody(value); onDraftChange?.(value); }} autoFocus rows={3} minHeight="80px"
        mentionOptions={getDiscussionMentionOptions(session)} placeholder="Write a comment on this line…"
        showActions onSubmit={submit} submitLabel="Start Discussion" onCancel={onClose}
        disabled={isSubmitting} isSubmitting={isSubmitting} />
    </div>
  );
};
