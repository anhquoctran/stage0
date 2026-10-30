import React,{ useCallback,useRef,useState } from 'react';
import { useTranslation as useUiTextTranslation } from 'react-i18next';
import { useDateTimeLanguage } from '../../i18n/hooks/useDateTimeLanguage';
import { parseMentionReference } from '../../../common/utils/mentions';
import { useGitStore } from '../../git/store/useGitStore';
import { useVirtualMrStore } from '../store/useVirtualMrStore';
import type { DiscussionReference } from '../types/DiscussionReference';
import type { VirtualMrComment } from '../types/VirtualMrComment';
import type { VirtualMrDiscussion } from '../types/VirtualMrDiscussion';
import type { VirtualMrSession } from '../types/VirtualMrSession';
import { formatGitLabTime,getAuthorBadges,getAuthorHandle } from '../utils/discussionAuthorUtils';
import { getDiscussionMentionOptions } from '../utils/discussionMentions';
import {
buildDiscussionQuote,
getDiscussionComments,
isResolvableDiscussion,
parseDiscussionReference,
} from '../utils/discussionReferences';
import * as codeContextModule from './DiscussionCodeContext';
import { DiscussionReferenceDialog } from './DiscussionReferenceDialog';
import { DiscussionCommentCard } from './discussion/DiscussionCommentCard';
import { DiscussionReplyBox } from './discussion/DiscussionReplyBox';
import { DiscussionReplyComment } from './discussion/DiscussionReplyComment';
import { PendingDiscussionReply } from './discussion/PendingDiscussionReply';
import { DiscussionThreadHeader } from './discussion/DiscussionThreadHeader';

const DiscussionCodeContext = codeContextModule?.DiscussionCodeContext || (() => null);

export const DiscussionThread: React.FC<{
  session: VirtualMrSession;
  discussion: VirtualMrDiscussion;
}> = ({ session, discussion }) => {
  const { t: translateUiText } = useUiTextTranslation();
  useDateTimeLanguage();
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
        showToast(translateUiText(discussion.isResolved ? 'virtualMr.discussion.threadReopened' : 'virtualMr.discussion.threadResolved'), 'success');
      }
    } catch (err: any) {
      showToast(translateUiText('virtualMr.discussion.updateFailed', { error: err?.message || err }), 'error');
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
      showToast(translateUiText(andResolve ? 'virtualMr.discussion.repliedAndResolved' : 'virtualMr.discussion.commentPosted'), 'success');
    } catch (error) {
      showToast(
        translateUiText('virtualMr.discussion.postFailed', { error: error instanceof Error ? error.message : String(error) }),
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
          ? translateUiText('virtualMr.discussion.participant', { name: person.label, kind: translateUiText(person.kind === 'reviewer' ? 'virtualMr.discussion.reviewerKind' : 'virtualMr.discussion.assigneeKind') })
          : translateUiText('virtualMr.discussion.participantUnassigned'),
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
    else showToast(translateUiText('virtualMr.discussion.quoteUnavailable'), 'warning');
  };

  const rootAuthorName = rootComment?.authorName || translateUiText('virtualMr.discussion.reviewerFallback');
  const rootAuthorHandle = getAuthorHandle(
    rootAuthorName,
    rootComment?.authorId || session?.assignee?.email,
    rootComment?.authorType
  );
  const threadRelativeTime = formatGitLabTime(discussion.createdAt || rootComment?.createdAt || '');

  return (
    <div className="space-y-2 select-text font-sans" onClick={openReference}>
      {/* 1. Outer GitLab Thread Summary Header */}
      <DiscussionThreadHeader
        rootAuthorName={rootAuthorName}
        rootComment={rootComment}
        rootAuthorHandle={rootAuthorHandle}
        discussion={discussion}
        threadRelativeTime={threadRelativeTime}
        quote={quote}
        isSubmitting={isSubmitting}
      />

      {/* 2. The GitLab Discussion Box / Card (No rounded style - sharp borders) */}
      <div
        className={`border bg-mantle overflow-hidden shadow-xs transition-colors rounded-sm ${
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
          />
        )}

        {/* Replies Section (Collapsible replies with clear thread hierarchy) */}
        {replies.length > 0 && (
          <div className="border-t border-surface0/80">
            {/* Collapse / Expand Replies Bar */}
            <div className="flex items-center justify-between px-3.5 py-1.5 bg-surface0/30 border-b border-surface0/60 rounded-sm">
              <button
                type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="flex items-center gap-1.5 text-xs text-subtext0 hover:text-text font-medium transition-colors cursor-pointer rounded-sm"
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
                  className={`transition-transform duration-150 ${isCollapsed ? '-rotate-90 rtl:rotate-90' : ''}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                <span>
                  {isCollapsed ? translateUiText('virtualMr.discussion.expandReplies', { count: replies.length }) : translateUiText('virtualMr.discussion.collapseReplies')}
                </span>
              </button>

              <span className="text-[11px] text-subtext0 font-mono">
                {translateUiText('virtualMr.discussion.repliesCount', { count: replies.length })}
              </span>
            </div>

            {/* Replies List with Left Vertical Thread Connector Line */}
            {!isCollapsed && (
              <div className="bg-mantle/60 px-3.5 py-3 space-y-3 rounded-sm">
                <div className="ms-2 ps-3.5 border-s-2 border-surface1 space-y-3">
                  {replies.map((reply) => {
                    if (reply.isPending) {
                      return (
                        <PendingDiscussionReply
                          key={reply.id}
                          authorName={reply.authorName}
                          label={reply.pendingLabel || translateUiText('virtualMr.discussion.reviewingFallback')}
                        />
                      );
                    }
                    const handle = getAuthorHandle(
                      reply.authorName,
                      reply.authorId || session?.assignee?.email,
                      reply.authorType
                    );
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
