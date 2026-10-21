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
import * as codeContextModule from './DiscussionCodeContext';

const DiscussionCodeContext = codeContextModule?.DiscussionCodeContext || (() => null);

// GitLab authentic identicon color pairs (foreground & dark background)
const GITLAB_IDENTICON_PALETTES = [
  { fg: '#e24329', bg: '#3a1b24' }, // Red / Pink
  { fg: '#a27be8', bg: '#28193f' }, // Purple
  { fg: '#3f98e6', bg: '#102742' }, // Blue
  { fg: '#2da160', bg: '#0f2f1e' }, // Green
  { fg: '#df8e1d', bg: '#34230d' }, // Amber / Orange
  { fg: '#1ea9b0', bg: '#0b2b2f' }, // Teal / Cyan
  { fg: '#d0537d', bg: '#391a2b' }, // Magenta
  { fg: '#6b4fbb', bg: '#22153b' }, // Violet
];

function stringHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Derives a GitLab style handle (@handle) from full name or authorId.
 */
function getAuthorHandle(name: string, authorId?: string): string {
  if (authorId && authorId.includes('@')) {
    const localPart = authorId.split('@')[0];
    if (localPart && localPart !== 'user') return `@${localPart}`;
  }

  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .trim()
    .toLowerCase();

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const lastName = words[words.length - 1];
    const otherInitials = words.slice(0, -1).map((w) => w[0]).join('');
    return `@${lastName}${otherInitials}`;
  }

  return `@${normalized.replace(/[^a-z0-9]/g, '') || 'user'}`;
}

/**
 * Returns role badges matching GitLab (Author, Maintainer, Developer, AI Reviewer).
 */
function getAuthorBadges(
  authorName: string,
  authorType: 'user' | 'ai_agent',
  session?: VirtualMrSession
): string[] {
  const badges: string[] = [];
  if (authorType === 'ai_agent') {
    badges.push('AI Reviewer');
    return badges;
  }
  if (!session) {
    badges.push('Developer');
    return badges;
  }
  const isAuthor =
    authorName.toLowerCase() === session.assignee.name.toLowerCase() ||
    authorName.toLowerCase() === session.assignee.email.toLowerCase();

  if (isAuthor) {
    badges.push('Author');
    badges.push('Developer');
  } else {
    badges.push('Maintainer');
  }
  return badges;
}

/**
 * Formats time in GitLab style: "1 day ago", "2 hours ago", "just now".
 * Automatically normalizes SQLite UTC timestamps ("YYYY-MM-DD HH:MM:SS") to ISO UTC ("...Z")
 * to avoid local timezone offset miscalculations.
 */
function formatGitLabTime(dateInput: string): string {
  if (!dateInput) return '';
  let str = dateInput.trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(str)) {
    str = `${str.replace(' ', 'T')}Z`;
  }
  const date = new Date(str);
  if (Number.isNaN(date.getTime())) return formatTime(dateInput);

  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes === 1) return '1 minute ago';
  if (minutes < 60) return `${minutes} minutes ago`;

  const hours = Math.floor(seconds / 3600);
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;

  const days = Math.floor(seconds / 86400);
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;

  const months = Math.floor(seconds / (30 * 86400));
  if (months === 1) return '1 month ago';
  if (months < 12) return `${months} months ago`;

  const years = Math.floor(seconds / (365 * 86400));
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

/**
 * GitLab 5x5 Symmetric Identicon Component (Circular avatar)
 */
const GitLabIdenticon: React.FC<{
  name: string;
  email?: string;
  avatarUrl?: string;
  isAiAgent?: boolean;
  size?: 'sm' | 'md';
}> = ({ name, email, avatarUrl, isAiAgent = false, size = 'md' }) => {
  const sizeClass = size === 'sm' ? 'w-6 h-6' : 'w-8 h-8';

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${sizeClass} rounded-full object-cover shrink-0 ring-1 ring-surface1`}
      />
    );
  }

  if (isAiAgent) {
    return (
      <div
        className={`${sizeClass} rounded-full bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/40 flex items-center justify-center shrink-0 font-bold text-[10px]`}
        title={`${name} (AI Reviewer)`}
      >
        AI
      </div>
    );
  }

  const seed = email || name || 'user';
  const hash = stringHash(seed);
  const palette = GITLAB_IDENTICON_PALETTES[hash % GITLAB_IDENTICON_PALETTES.length];

  const rects: React.ReactNode[] = [];
  const cellSize = 10;

  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      const sourceCol = x > 2 ? 4 - x : x;
      const bitIndex = y * 3 + sourceCol;
      const isFilled = ((hash >> bitIndex) & 1) === 1;

      if (isFilled) {
        rects.push(
          <rect
            key={`${x}-${y}`}
            x={x * cellSize}
            y={y * cellSize}
            width={cellSize}
            height={cellSize}
            fill={palette.fg}
          />
        );
      }
    }
  }

  return (
    <div
      className={`${sizeClass} rounded-full overflow-hidden shrink-0 ring-1 ring-surface1 shadow-xs`}
      title={name}
    >
      <svg
        viewBox="0 0 50 50"
        className="w-full h-full"
        style={{ backgroundColor: palette.bg }}
      >
        {rects}
      </svg>
    </div>
  );
};

export const DiscussionThread: React.FC<{
  session: VirtualMrSession;
  discussion: VirtualMrDiscussion;
}> = ({ session, discussion }) => {
  const { replyToDiscussion, resolveDiscussion, createDiscussion } = useVirtualMrStore();
  const { showToast } = useGitStore();
  const [isReplying, setIsReplying] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(discussion.isResolved);
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

  const sourceDiscussion = reference && session.discussions.find((item) => reference.kind === 'discussion'
    ? item.id === reference.id : getDiscussionComments(item).some((comment) => comment.id === reference.id));
  const sourceComment = reference?.kind === 'comment' && sourceDiscussion
    ? getDiscussionComments(sourceDiscussion).find((item) => item.id === reference.id) : undefined;

  const quote = (comment?: VirtualMrComment) => {
    const quoted = buildDiscussionQuote(discussion, comment);
    if (!isReplying) setTargetId(discussion.id);
    setBody((previous) => previous ? `${previous.trimEnd()}\n\n${quoted}` : quoted);
    setIsReplying(true);
    setIsCollapsed(false);
  };

  const handleToggleResolve = async () => {
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
        if (andResolve && !discussion.isResolved && resolveDiscussion) {
          await resolveDiscussion(discussion.id, true);
        }
      }
      setBody('');
      setTargetId(discussion.id);
      setIsReplying(false);
      setResolveThread(false);
      showToast(andResolve ? 'Replied and resolved thread' : 'Comment posted', 'success');
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
      event.preventDefault();
      event.stopPropagation();
      const participants = getDiscussionMentionOptions(session, 'ai_agent', '');
      const person = participants.find((item) => item.kind === mention.kind && item.id === mention.id);
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
          <GitLabIdenticon
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
            <span className="text-subtext0 font-normal">
              {rootAuthorHandle}
            </span>
            <span>
              {discussion.filePath ? 'started a thread on the diff' : 'started a discussion'}
            </span>
            <time dateTime={discussion.createdAt || rootComment?.createdAt} className="text-subtext0">
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
          discussion.isResolved ? 'border-surface1/60 opacity-95' : 'border-surface1'
        }`}
      >
        {/* Optional Diff Code Snippet Context Preview (if on diff) */}
        {discussion.filePath && (
          <DiscussionCodeContext discussion={discussion} />
        )}

        {/* Root Discussion Comment (Prominently displayed as the discussion starter) */}
        {rootComment && (
          <div className="p-3.5 text-xs text-text transition-colors bg-mantle">
            <div className="flex gap-3">
              <GitLabIdenticon
                name={rootComment.authorName}
                email={rootComment.authorId}
                avatarUrl={rootComment.authorAvatar}
                isAiAgent={rootComment.authorType === 'ai_agent'}
                size="md"
              />

              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-1.5 leading-tight">
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    <span className="font-semibold text-text text-xs hover:underline cursor-pointer">
                      {rootComment.authorName}
                    </span>
                    <span className="text-subtext0 text-xs font-normal">
                      {getAuthorHandle(rootComment.authorName, rootComment.authorId)}
                    </span>
                    <span className="text-subtext0 select-none">·</span>
                    <time dateTime={rootComment.createdAt} className="text-subtext0 text-xs">
                      {formatGitLabTime(rootComment.createdAt)}
                    </time>
                  </div>

                  {/* Badges & Quote */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Clear Root Discussion Tag */}
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold border border-blue/40 bg-blue/10 text-blue select-none">
                      Root Discussion
                    </span>

                    {getAuthorBadges(rootComment.authorName, rootComment.authorType, session).map((badge) => (
                      <span
                        key={badge}
                        className="px-1.5 py-0.5 text-[10px] font-semibold border border-surface2 bg-surface1/60 text-subtext1 select-none"
                      >
                        {badge}
                      </span>
                    ))}

                    {discussion.isResolved && (
                      <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 select-none">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>Resolved</span>
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => quote(rootComment)}
                      disabled={isSubmitting}
                      className="p-1 text-subtext0 hover:text-brand hover:bg-surface0 transition-colors cursor-pointer"
                      aria-label={`Quote comment ${rootComment.id}`}
                      title={`Quote comment ${rootComment.id}`}
                    >
                      <Quote className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                <div className="pt-0.5 leading-relaxed text-text select-text">
                  <MarkdownPreview content={rootComment.body} />
                </div>
              </div>
            </div>
          </div>
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
                <span>{isCollapsed ? `Expand replies (${replies.length})` : 'Collapse replies'}</span>
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
                      <div key={reply.id} className="group relative flex gap-3 text-xs text-text transition-colors">
                        <GitLabIdenticon
                          name={reply.authorName}
                          email={reply.authorId}
                          avatarUrl={reply.authorAvatar}
                          isAiAgent={reply.authorType === 'ai_agent'}
                          size="sm"
                        />

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-1.5 leading-tight">
                            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                              <span className="font-semibold text-text text-xs hover:underline cursor-pointer">
                                {reply.authorName}
                              </span>
                              <span className="text-subtext0 text-xs font-normal">
                                {handle}
                              </span>
                              <span className="text-subtext0 select-none">·</span>
                              <time dateTime={reply.createdAt} className="text-subtext0 text-xs">
                                {relativeTime}
                              </time>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="px-1.5 py-0.5 text-[10px] font-medium border border-surface1 bg-surface0/50 text-subtext0 select-none">
                                Reply
                              </span>

                              {badges.map((badge) => (
                                <span
                                  key={badge}
                                  className="px-1.5 py-0.5 text-[10px] font-semibold border border-surface2 bg-surface1/60 text-subtext1 select-none"
                                >
                                  {badge}
                                </span>
                              ))}

                              <button
                                type="button"
                                onClick={() => quote(reply)}
                                disabled={isSubmitting}
                                className="p-1 text-subtext0 hover:text-brand hover:bg-surface0 transition-colors cursor-pointer"
                                aria-label={`Quote comment ${reply.id}`}
                                title={`Quote comment ${reply.id}`}
                              >
                                <Quote className="h-3 w-3" />
                              </button>
                            </div>
                          </div>

                          <div className="pt-0.5 leading-relaxed text-text select-text">
                            <MarkdownPreview content={reply.body} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bottom Reply & Resolve Bar */}
        <div className="border-t border-surface0/80 p-3.5 bg-surface0/20">
          {isReplying ? (
            <div className="space-y-3 animate-in fade-in duration-100">
              {/* Destination selector: hidden from visible UI as replies automatically target this thread */}
              <div className="hidden" aria-hidden="true">
                <CustomSelect
                  value={targetId}
                  onChange={setTargetId}
                  disabled={isSubmitting}
                  searchable
                  options={[
                    { value: discussion.id, label: `This thread · ${rootComment?.body.slice(0, 60) || discussion.id}` },
                    { value: 'new', label: 'New general discussion' },
                    ...session.discussions
                      .filter((item) => item.id !== discussion.id)
                      .map((item) => ({
                        value: item.id,
                        label: `${item.filePath ? `${item.filePath}:${item.lineNumber ?? 1}` : 'General'} · ${item.rootComment?.body.slice(0, 60) || item.id}`,
                        description: item.id,
                      })),
                  ]}
                  aria-label="Reply destination"
                  className="min-w-0 flex-1"
                  buttonClassName="w-full"
                  dropdownWidth="w-full"
                  align="left"
                />
              </div>

              {/* GitLab Markdown Editor */}
              <MarkdownEditor
                value={body}
                onChange={setBody}
                rows={4}
                minHeight="110px"
                autoFocus
                mentionOptions={getDiscussionMentionOptions(session)}
                placeholder="Write a comment or drag your files here…"
                showActions={false}
                onSubmit={() => submit(resolveThread)}
                disabled={isSubmitting}
                isSubmitting={isSubmitting}
              />

              {/* Below editor: Resolve thread checkbox & action buttons (No rounded style) */}
              <div className="space-y-2.5 pt-0.5">
                {!discussion.isResolved && targetId === discussion.id && (
                  <label className="inline-flex items-center gap-2 text-xs text-text cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={resolveThread}
                      onChange={(e) => setResolveThread(e.target.checked)}
                      className="border border-surface1 bg-crust text-blue focus:ring-0 cursor-pointer w-4 h-4"
                    />
                    <span>Resolve thread</span>
                  </label>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => submit(resolveThread)}
                    disabled={isSubmitting || !body.trim()}
                    className="px-4 py-1.5 bg-blue hover:bg-blue/90 text-crust font-semibold text-xs shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {targetId === 'new' ? 'Start Discussion' : 'Add comment now'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsReplying(false);
                      setBody('');
                      setResolveThread(false);
                    }}
                    disabled={isSubmitting}
                    className="px-3.5 py-1.5 border border-surface1 bg-surface1 hover:bg-surface2 text-text text-xs font-medium transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setTargetId(discussion.id);
                  setIsReplying(true);
                  setIsCollapsed(false);
                }}
                aria-label={`Reply to discussion ${discussion.id}`}
                className="flex-1 text-left px-3 py-1.5 border border-surface1 bg-crust/50 hover:bg-crust hover:border-surface2 text-subtext0 hover:text-subtext1 text-xs transition-all cursor-text flex items-center justify-between shadow-inner"
              >
                <span>Reply...</span>
                <span className="text-[10px] text-subtext0/70 font-mono">r</span>
              </button>

              <button
                type="button"
                onClick={handleToggleResolve}
                className="px-3 py-1.5 border border-surface1 bg-surface0 hover:bg-surface1 text-text text-xs font-medium flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer shrink-0"
                title={discussion.isResolved ? 'Reopen this thread' : 'Mark this thread as resolved'}
              >
                <span>{discussion.isResolved ? 'Reopen thread' : 'Resolve thread'}</span>
              </button>
            </div>
          )}
        </div>
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
