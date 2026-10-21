import React, { useCallback, useRef, useState } from 'react';
import { CustomSelect } from '../../../common/components/CustomSelect';
import { MarkdownEditor } from '../../../common/components/MarkdownEditor';
import { MarkdownPreview } from '../../../common/components/MarkdownPreview';
import { Quote } from '../../../common/components/icons/Quote';
import { formatTime } from '../../../common/utils/dateTime';
import { useGitStore } from '../../git/store/useGitStore';
import { useVirtualMrStore } from '../store/useVirtualMrStore';
import type { VirtualMrDiscussion } from '../types/VirtualMrDiscussion';
import type { VirtualMrSession } from '../types/VirtualMrSession';
import type { VirtualMrComment } from '../types/VirtualMrComment';
import type { DiscussionReference } from '../types/DiscussionReference';
import { buildDiscussionQuote, getDiscussionComments, parseDiscussionReference } from '../utils/discussionReferences';
import { DiscussionReferenceDialog } from './DiscussionReferenceDialog';
import { getDiscussionMentionOptions } from '../utils/discussionMentions';
import { parseMentionReference } from '../../../common/utils/mentions';
import { DiscussionCodeContext } from './DiscussionCodeContext';

export const DiscussionThread: React.FC<{
  session: VirtualMrSession;
  discussion: VirtualMrDiscussion;
}> = ({ session, discussion }) => {
  const { replyToDiscussion, createDiscussion } = useVirtualMrStore();
  const { showToast } = useGitStore();
  const [isReplying, setIsReplying] = useState(false);
  const [body, setBody] = useState('');
  const [targetId, setTargetId] = useState(discussion.id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reference, setReference] = useState<DiscussionReference | null>(null);
  const submittingRef = useRef(false);
  const closeReference = useCallback(() => setReference(null), []);

  const comments = getDiscussionComments(discussion);
  const sourceDiscussion = reference && session.discussions.find((item) => reference.kind === 'discussion'
    ? item.id === reference.id : getDiscussionComments(item).some((comment) => comment.id === reference.id));
  const sourceComment = reference?.kind === 'comment' && sourceDiscussion
    ? getDiscussionComments(sourceDiscussion).find((item) => item.id === reference.id) : undefined;

  const quote = (comment?: VirtualMrComment) => {
    const quoted = buildDiscussionQuote(discussion, comment);
    if (!isReplying) setTargetId(discussion.id);
    setBody((previous) => previous ? `${previous.trimEnd()}\n\n${quoted}` : quoted);
    setIsReplying(true);
  };

  const submit = async () => {
    if (!body.trim() || submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      if (targetId === 'new') await createDiscussion(session.id, { initialComment: body.trim() });
      else await replyToDiscussion(targetId, body.trim());
      setBody('');
      setTargetId(discussion.id);
      setIsReplying(false);
      showToast(targetId === 'new' ? 'Discussion posted' : 'Reply posted', 'success');
    } catch (error) {
      showToast(`Could not post: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const openReference = (event: React.MouseEvent<HTMLDivElement>) => {
    const link = (event.target as HTMLElement).closest?.('a');
    const mention = parseMentionReference(link?.getAttribute('href') ?? '');
    if (mention) {
      event.preventDefault(); event.stopPropagation();
      const participants = getDiscussionMentionOptions(session, 'ai_agent', '');
      const person = participants.find((item) => item.kind === mention.kind && item.id === mention.id);
      showToast(person ? `${person.label} · ${person.kind === 'reviewer' ? 'AI reviewer' : 'Assignee'}` : 'This participant is no longer assigned to this MR.', person ? 'info' : 'warning');
      return;
    }
    const parsed = parseDiscussionReference(link?.getAttribute('href') ?? '');
    if (!parsed) return;
    event.preventDefault();
    event.stopPropagation();
    const exists = session.discussions.some((item) => parsed.kind === 'discussion'
      ? item.id === parsed.id : getDiscussionComments(item).some((comment) => comment.id === parsed.id));
    if (exists) setReference(parsed);
    else showToast('The quoted source is no longer available in this MR.', 'warning');
  };

  return (
    <div className="space-y-3" onClick={openReference}>
      <DiscussionCodeContext discussion={discussion} />
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-subtext0">
        <span className="min-w-0 break-all font-mono" title={discussion.id}>Discussion {discussion.id}</span>
        <button type="button" onClick={() => quote()} disabled={isSubmitting}
          className="flex shrink-0 items-center gap-1 text-subtext0 hover:text-brand disabled:opacity-50" aria-label={`Quote discussion ${discussion.id}`}>
          <Quote className="h-3 w-3" /> Quote discussion
        </button>
      </div>
      {comments.map((comment, index) => (
        <div key={comment.id} className={index ? 'ml-4 space-y-1 border-l-2 border-surface1 py-1 pl-3' : 'space-y-1'}>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="font-medium text-text">{comment.authorName}</span>
            {comment.reviewAction === 'request_changes' && <span className="text-[10px] font-semibold text-red-400">REQUEST CHANGES</span>}
            <time dateTime={comment.createdAt} className="text-subtext0">{formatTime(comment.createdAt)}</time>
            <span className="min-w-0 break-all font-mono text-[10px] text-subtext0" title={comment.id}>{comment.id}</span>
            <button type="button" onClick={() => quote(comment)} disabled={isSubmitting}
              className="ml-auto flex items-center gap-1 text-subtext0 hover:text-brand disabled:opacity-50" aria-label={`Quote comment ${comment.id}`}>
              <Quote className="h-3 w-3" /> Quote
            </button>
          </div>
          <MarkdownPreview content={comment.body} />
        </div>
      ))}
      {isReplying ? (
        <div className="space-y-2 border-t border-surface0 pt-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-subtext0">Post to</span>
            <CustomSelect value={targetId} onChange={setTargetId} disabled={isSubmitting} searchable
              options={[
                { value: 'new', label: 'New general discussion' },
                ...session.discussions.map((item) => ({
                  value: item.id,
                  label: `${item.filePath ? `${item.filePath}:${item.lineNumber ?? 1}` : 'General'} · ${item.rootComment?.body.slice(0, 70) || item.id}`,
                  description: item.id,
                })),
              ]}
              aria-label="Reply destination" className="min-w-0 flex-1" buttonClassName="w-full" dropdownWidth="w-full" align="left" />
          </div>
          <MarkdownEditor value={body} onChange={setBody} rows={3} minHeight="80px" autoFocus
            mentionOptions={getDiscussionMentionOptions(session)}
            placeholder="Write a reply…" showActions onSubmit={submit} submitLabel={targetId === 'new' ? 'Post Discussion' : 'Post Reply'}
            disabled={isSubmitting} isSubmitting={isSubmitting} onCancel={() => setIsReplying(false)} />
        </div>
      ) : (
        <button type="button" onClick={() => { setTargetId(discussion.id); setIsReplying(true); }} aria-label={`Reply to discussion ${discussion.id}`}
          className="border border-surface1 bg-surface0 px-3 py-1 text-xs text-text hover:bg-surface1">Reply</button>
      )}
      {sourceDiscussion && (
        <DiscussionReferenceDialog discussion={sourceDiscussion} comment={sourceComment} onClose={closeReference} />
      )}
    </div>
  );
};
