import React, { useCallback, useRef, useState } from 'react';
import { Quote } from '../../../common/components/icons/Quote';
import { parseMentionReference } from '../../../common/utils/mentions';
import { useGitStore } from '../../git/store/useGitStore';
import { useVirtualMrStore } from '../store/useVirtualMrStore';
import type { DiscussionReference } from '../types/DiscussionReference';
import type { VirtualMrComment } from '../types/VirtualMrComment';
import type { VirtualMrDiscussion } from '../types/VirtualMrDiscussion';
import type { VirtualMrSession } from '../types/VirtualMrSession';
import { formatGitLabTime, getAuthorBadges, getAuthorHandle } from '../utils/discussionAuthorUtils';
import { getDiscussionMentionOptions } from '../utils/discussionMentions';
import {
  buildDiscussionQuote,
  getDiscussionComments,
  isResolvableDiscussion,
  parseDiscussionReference,
} from '../utils/discussionReferences';
import * as codeContextModule from './DiscussionCodeContext';
import { DiscussionReferenceDialog } from './DiscussionReferenceDialog';
import { GitLabAvatar } from './GitLabAvatar';
import { DiscussionCommentCard } from './discussion/DiscussionCommentCard';
import { DiscussionReplyBox } from './discussion/DiscussionReplyBox';
import { DiscussionReplyComment } from './discussion/DiscussionReplyComment';

const DiscussionCodeContext = codeContextModule?.DiscussionCodeContext || (() => null);

export const DiscussionThread: React.FC<{
  session: VirtualMrSession;
  discussion: VirtualMrDiscussion;
}> = ({ session, discussion }) => {
  const { replyToDiscussion, resolveDiscussion, createDiscussion } = useVirtualMrStore();
  const { showToast } = useGitStore();
  const isResolvable = isResolvableDiscussion(discussion);
  const [isReplying, setIsReplying] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(isResolvable ? discussion.isResolved : false);
  const [body, setBody] = useState('');
  const [targetId, setTargetId] = useState(discussion.id);
  const [resolveThread, setResolveThread] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reference, setReference] = useState<DiscussionReference | null>(null);
  const submittingRef = useRef(false);
  const closeReference = useCallback(() => setReference(null), []);

  const comments = getDiscussionComments(discussion);
  const rootComment = discussion.rootComment || comments[0];
  const replies = discussion.rootComment ? discussion.children : comments.slice(1);

  const sourceDiscussion =
    reference &&
    session.discussions.find((item) =>
      reference.kind === 'discussion'
        ? item.id === reference.id
        : getDiscussionComments(item).some((comment) => comment.id === reference.id)
    );
  const sourceComment =
    reference?.kind === 'comment' && sourceDiscussion
      ? getDiscussionComments(sourceDiscussion).find((item) => item.id === reference.id)
      : undefined;

  const quote = (comment?: VirtualMrComment) => {
    const quoted = buildDiscussionQuote(discussion, comment);
    if (!isReplying) setTargetId(discussion.id);
    setBody((previous) => (previous ? `${previous.trimEnd()}\n\n${quoted}` : quoted));
    setIsReplying(true);
    setIsCollapsed(false);
  };

  const handleToggleResolve = async () => {
    if (!isResolvable) return;
    try {
      if (resolveDiscussion) {
        await resolveDiscussion(discussion.id, !discussion.isResolved);
        showToast(discussion.isResolved ? 'Thread reopened' : 'Thread resolved', 'success');
      }
    } catch (err: any) {
      showToast(`Could not update thread: ${err?.message || err}`, 'error');
    }
  };

  const submit = async (andResolve = false) => {
    if (!body.trim() || submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      if (targetId === 'new') {
        await createDiscussion(session.id, { initialComment: body.trim() });
      } else {
        await replyToDiscussion(targetId, body.trim());
        if (isResolvable && andResolve && !discussion.isResolved && resolveDiscussion) {
          await resolveDiscussion(discussion.id, true);
        }
      }
      setBody('');
      setTargetId(discussion.id);
      setIsReplying(false);
      setResolveThread(false);
      showToast(andResolve ? 'Replied and resolved thread' : 'Comment posted', 'success');
    } catch (error) {
      showToast(
        `Could not post: ${error instanceof Error ? error.message : String(error)}`,
        'error'
      );
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const openReference = (event: React.MouseEvent<HTMLDivElement>) => {
    const link = (event.target as HTMLElement).closest?.('a');
    const mention = parseMentionReference(link?.getAttribute('href') ?? '');
    if (mention) {
      event.preventDefault();
      event.stopPropagation();
      const participants = getDiscussionMentionOptions(session, 'ai_agent', '');
      const person = participants.find(
        (item) => item.kind === mention.kind && item.id === mention.id
      );
      showToast(
        person
          ? `${person.label} · ${person.kind === 'reviewer' ? 'AI reviewer' : 'Assignee'}`
          : 'This participant is no longer assigned to this MR.',
        person ? 'info' : 'warning'
      );
      return;
    }
    const parsed = parseDiscussionReference(link?.getAttribute('href') ?? '');
    if (!parsed) return;
    event.preventDefault();
    event.stopPropagation();
    const exists = session.discussions.some((item) =>
      parsed.kind === 'discussion'
        ? item.id === parsed.id
        : getDiscussionComments(item).some((comment) => comment.id === parsed.id)
    );
    if (exists) setReference(parsed);
    else showToast('The quoted source is no longer available in this MR.', 'warning');
  };

  const rootAuthorName = rootComment?.authorName || 'Reviewer';
  const rootAuthorHandle = getAuthorHandle(rootAuthorName, rootComment?.authorId);
  const threadRelativeTime = formatGitLabTime(discussion.createdAt || rootComment?.createdAt || '');

  return (
    <div className="space-y-2 select-text font-sans" onClick={openReference}>
      {/* 1. Outer GitLab Thread Summary Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <GitLabAvatar
            name={rootAuthorName}
            email={rootComment?.authorId}
            avatarUrl={rootComment?.authorAvatar}
            isAiAgent={rootComment?.authorType === 'ai_agent'}
            size="sm"
          />
          <div className="flex items-center gap-1.5 flex-wrap text-subtext0 leading-tight">
            <span className="font-semibold text-text hover:underline cursor-pointer">
              {rootAuthorName}
            </span>
            <span className="text-subtext0 font-normal">{rootAuthorHandle}</span>
            <span>
              {discussion.filePath ? 'started a thread on the diff' : 'started a discussion'}
            </span>
            <time
              dateTime={discussion.createdAt || rootComment?.createdAt}
              className="text-subtext0"
            >
              {threadRelativeTime}
            </time>
          </div>
        </div>

        {/* Right side: Line number badge and Quote Discussion Button */}
        <div className="flex items-center gap-2">
          {discussion.lineNumber && (
            <span className="font-mono text-[10px] text-subtext0 bg-surface0 border border-surface1 px-2 py-0.5">
              Line {discussion.lineNumber}
            </span>
          )}

          <button
            type="button"
            onClick={() => quote()}
            disabled={isSubmitting}
            className="flex shrink-0 items-center gap-1 text-subtext0 hover:text-brand disabled:opacity-50 text-[11px] p-1 hover:bg-surface0 transition-colors cursor-pointer"
            aria-label={`Quote discussion ${discussion.id}`}
          >
            <Quote className="h-3 w-3" />
            <span>Quote discussion</span>
          </button>
        </div>
      </div>

      {/* 2. The GitLab Discussion Box / Card (No rounded style - sharp borders) */}
      <div
        className={`border bg-mantle overflow-hidden shadow-xs transition-colors ${
          isResolvable && discussion.isResolved
            ? 'border-surface1/60 opacity-95'
            : 'border-surface1'
        }`}
      >
        {/* Optional Diff Code Snippet Context Preview (if on diff) */}
        {discussion.filePath && <DiscussionCodeContext discussion={discussion} />}

        {/* Root Discussion Comment (Prominently displayed as the discussion starter) */}
        {rootComment && (
          <DiscussionCommentCard
            rootComment={rootComment}
            session={session}
            isResolvable={isResolvable}
            discussion={discussion}
            quote={quote}
            isSubmitting={isSubmitting}
          />
        )}

        {/* Replies Section (Collapsible replies with clear thread hierarchy) */}
        {replies.length > 0 && (
          <div className="border-t border-surface0/80">
            {/* Collapse / Expand Replies Bar */}
            <div className="flex items-center justify-between px-3.5 py-1.5 bg-surface0/30 border-b border-surface0/60">
              <button
                type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="flex items-center gap-1.5 text-xs text-subtext0 hover:text-text font-medium transition-colors cursor-pointer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-transform duration-150 ${isCollapsed ? '-rotate-90' : ''}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                <span>
                  {isCollapsed ? `Expand replies (${replies.length})` : 'Collapse replies'}
                </span>
              </button>

              <span className="text-[11px] text-subtext0 font-mono">
                {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
              </span>
            </div>

            {/* Replies List with Left Vertical Thread Connector Line */}
            {!isCollapsed && (
              <div className="bg-mantle/60 px-3.5 py-3 space-y-3">
                <div className="ml-2 pl-3.5 border-l-2 border-surface1 space-y-3">
                  {replies.map((reply) => {
                    const handle = getAuthorHandle(reply.authorName, reply.authorId);
                    const badges = getAuthorBadges(reply.authorName, reply.authorType, session);
                    const relativeTime = formatGitLabTime(reply.createdAt);

                    return (
                      <DiscussionReplyComment
                        key={reply.id}
                        reply={reply}
                        handle={handle}
                        relativeTime={relativeTime}
                        badges={badges}
                        quote={quote}
                        isSubmitting={isSubmitting}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bottom Reply & Resolve Bar */}
        <DiscussionReplyBox
          isReplying={isReplying}
          targetId={targetId}
          setTargetId={setTargetId}
          isSubmitting={isSubmitting}
          discussion={discussion}
          rootComment={rootComment}
          session={session}
          body={body}
          setBody={setBody}
          submit={submit}
          resolveThread={resolveThread}
          isResolvable={isResolvable}
          setResolveThread={setResolveThread}
          setIsReplying={setIsReplying}
          setIsCollapsed={setIsCollapsed}
          handleToggleResolve={handleToggleResolve}
        />
      </div>

      {sourceDiscussion && (
        <DiscussionReferenceDialog
          discussion={sourceDiscussion}
          comment={sourceComment}
          onClose={closeReference}
        />
      )}
    </div>
  );
};
