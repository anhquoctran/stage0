import React, { useRef, useState } from 'react';
import { MessageSquare } from '../../../common/components/icons/MessageSquare';
import { Bot } from '../../../common/components/icons/Bot';
import { User } from '../../../common/components/icons/User';
import { CheckCircle2 } from '../../../common/components/icons/CheckCircle2';
import { ExternalLink } from '../../../common/components/icons/ExternalLink';
import { RefreshCw } from '../../../common/components/icons/RefreshCw';
import { Plus } from '../../../common/components/icons/Plus';
import { X } from '../../../common/components/icons/X';
import { ChevronDown } from '../../../common/components/icons/ChevronDown';
import { ChevronRight } from '../../../common/components/icons/ChevronRight';
import { Code2 } from '../../../common/components/icons/Code2';
import { useVirtualMrStore } from '../../virtual-mr/store/useVirtualMrStore';
import { useGitStore } from '../store/useGitStore';
import { openFileInEditor } from '../utils/fileActions';
import { type ReviewActionType } from '../../virtual-mr/types/ReviewActionType';
import { MarkdownEditor } from '../../../common/components/MarkdownEditor';
import { DiscussionThread } from '../../virtual-mr/components/DiscussionThread';
import { getDiscussionMentionOptions } from '../../virtual-mr/utils/discussionMentions';
import type { DiffDiscussionsBannerProps } from '../types/DiffDiscussionsBannerProps';
import { AI_REVIEW_UNAVAILABLE } from '../../ai/constants/runtimeAvailability';

export const DiffDiscussionsBanner: React.FC<DiffDiscussionsBannerProps> = ({ selectedFile }) => {
  const { currentRepo, showToast } = useGitStore();
  const {
    getActiveSession,
    createDiscussion,
    resolveDiscussion,
  } = useVirtualMrStore();

  const session = getActiveSession();
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [targetLine, setTargetLine] = useState<number>(1);
  const [commentText, setCommentText] = useState('');
  const [isPostingDiscussion, setIsPostingDiscussion] = useState(false);
  const postingDiscussionRef = useRef(false);
  const commentAction: ReviewActionType = 'comment';
  const [collapsedDiscIds, setCollapsedDiscIds] = useState<{ [discId: string]: boolean }>({});

  if (!session || !currentRepo) return null;

  const fileDiscussions = session.discussions.filter((d) => d.filePath === selectedFile.path);

  const handleOpenInIde = async (line?: number | null) => {
    try {
      await openFileInEditor(currentRepo.local_path, selectedFile.path, line || undefined);
      showToast(`Opened ${selectedFile.path}${line ? ` at line ${line}` : ''} in VS Code`);
    } catch (err: any) {
      showToast(`Failed to open in IDE: ${err}`);
    }
  };

  const handleCreateDiscussion = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!commentText.trim() || postingDiscussionRef.current) return;
    postingDiscussionRef.current = true;
    setIsPostingDiscussion(true);
    try {
      await createDiscussion(session.id, {
        filePath: selectedFile.path,
        lineNumber: targetLine || 1,
        diffSide: 'right',
        initialComment: commentText.trim(),
        reviewAction: commentAction,
      });
      setCommentText('');
      setIsAddingComment(false);
      showToast('Review comment added', 'success');
    } catch (error) {
      showToast(`Could not post discussion: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      postingDiscussionRef.current = false;
      setIsPostingDiscussion(false);
    }
  };

  const toggleCollapse = (id: string) => {
    setCollapsedDiscIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="mb-3 space-y-2 text-xs">
      {/* HEADER BAR FOR FILE DISCUSSIONS */}
      <div className="flex items-center justify-between p-2  bg-surface0/60 border border-surface1 text-text">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-accent" />
          <span className="font-semibold text-xs">
            Review Discussions ({fileDiscussions.length})
          </span>
          {fileDiscussions.length > 0 && (
            <span className="text-[11px] text-subtext0">
              ({fileDiscussions.filter((d) => !d.isResolved).length} unresolved)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleOpenInIde()}
            className="flex items-center gap-1 px-2.5 py-1  bg-surface1 hover:bg-surface2 text-text font-medium text-[11px] transition-colors cursor-pointer"
            title="Open this file in VS Code to edit code"
          >
            <Code2 className="w-3 h-3 text-subtext0" />
            <span>Open in IDE</span>
          </button>
          {!selectedFile.is_binary && (
            <button
              type="button"
              onClick={() => setIsAddingComment(!isAddingComment)}
              className="flex items-center gap-1 px-2.5 py-1  bg-brand hover:bg-brand/90 text-on-accent font-semibold text-[11px] transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-3 h-3" />
              <span>Add Comment</span>
            </button>
          )}
        </div>
      </div>

      {selectedFile.is_binary && (
        <div className="px-3 py-2  bg-surface0/50 border border-surface1 text-subtext0">
          Line comments are unavailable for binary files. Existing discussions are retained below.
        </div>
      )}

      {/* NEW COMMENT FORM */}
      {isAddingComment && !selectedFile.is_binary && (
        <div className="p-3.5  bg-crust border border-surface0 space-y-2.5 shadow-md">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-xs text-text">Add review comment on code line</span>
            <button
              type="button"
              onClick={() => setIsAddingComment(false)}
              className="text-subtext0 hover:text-text cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-subtext0 text-[11px]">Line:</span>
              <input
                type="number"
                min={1}
                value={targetLine}
                onChange={(e) => setTargetLine(parseInt(e.target.value, 10) || 1)}
                className="w-16 px-2 py-1  bg-surface0 border border-surface1 text-text text-xs focus:outline-none"
              />
            </div>
          </div>

          <MarkdownEditor
            value={commentText}
            mentionOptions={getDiscussionMentionOptions(session)}
            onChange={setCommentText}
            placeholder="Enter review comment (Markdown supported)..."
            rows={3}
            minHeight="80px"
            showActions={true}
            onSubmit={handleCreateDiscussion}
            submitLabel="Submit Comment"
            disabled={isPostingDiscussion}
            isSubmitting={isPostingDiscussion}
            onCancel={() => setIsAddingComment(false)}
            cancelLabel="Cancel"
          />
        </div>
      )}

      {/* DISCUSSIONS LIST */}
      {fileDiscussions.map((disc) => {
        const firstComment = disc.rootComment;
        const isCollapsed = collapsedDiscIds[disc.id] ?? disc.isResolved;

        return (
          <div
            key={disc.id}
            className={` border transition-colors shadow-xs ${
              disc.isResolved
                ? 'bg-surface0/30 border-surface0/50 opacity-80'
                : firstComment?.reviewAction === 'request_changes'
                ? 'bg-red-500/5 border-red-500/30'
                : 'bg-crust border-surface0'
            }`}
          >
            {/* THREAD HEADER */}
            <div className="px-3.5 py-2 flex items-center justify-between gap-3 border-b border-surface0/50 bg-mantle/60">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <button
                  type="button"
                  onClick={() => toggleCollapse(disc.id)}
                  className="text-subtext0 hover:text-text cursor-pointer p-0.5"
                >
                  {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {disc.lineNumber && (
                  <span className="font-mono font-bold text-accent px-1.5 py-0.2  bg-surface0 text-[11px]">
                    Line {disc.lineNumber}
                  </span>
                )}

                {/* Author badge */}
                <div className="flex items-center gap-1 font-medium text-text">
                  {firstComment?.authorType === 'ai_agent' ? (
                    <Bot className="w-3.5 h-3.5 text-purple-400" />
                  ) : (
                    <User className="w-3.5 h-3.5 text-accent" />
                  )}
                  <span>{firstComment?.authorName || 'Reviewer'}</span>
                </div>

                {/* Review Action Badge */}
                {firstComment?.reviewAction === 'request_changes' ? (
                  <span className="text-[10px] px-1.5 py-0.2  bg-red-500/20 text-red-400 font-mono font-semibold">
                    REQUEST CHANGES
                  </span>
                ) : firstComment?.reviewAction === 'approve' ? (
                  <span className="text-[10px] px-1.5 py-0.2  bg-emerald-500/20 text-emerald-400 font-mono font-semibold">
                    APPROVED
                  </span>
                ) : null}

                {/* Verification Badge */}
                {disc.resolveType === 'ai_verified' && (
                  <span title="Historical verification has no evidence-backed review run." className="text-[10px] px-1.5 py-0.2  bg-surface1 text-subtext0 font-mono flex items-center gap-1">
                    Legacy result · unverified
                  </span>
                )}
              </div>

              {/* Thread Action Controls */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Hand-off: Open in IDE at exact line */}
                <button
                  type="button"
                  onClick={() => handleOpenInIde(disc.lineNumber)}
                  className="px-2 py-0.5  bg-surface0 hover:bg-surface1 text-text text-[11px] font-mono flex items-center gap-1 cursor-pointer"
                  title={`Open file at line ${disc.lineNumber || 1} in VS Code to edit code`}
                >
                  <ExternalLink className="w-3 h-3 text-subtext0" />
                  <span>Open in IDE</span>
                </button>

                {/* AI Re-verify Fix Button */}
                {!disc.isResolved && (
                  <button
                    type="button"
                    disabled
                    className="px-2.5 py-1  bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-xs"
                    title={AI_REVIEW_UNAVAILABLE}
                  >
                    <RefreshCw className="w-3 h-3 text-white" />
                    <span className="text-white">Re-verify Fix</span>
                  </button>
                )}

                {/* Resolve / Unresolve Toggle */}
                <button
                  type="button"
                  onClick={() => resolveDiscussion(disc.id, !disc.isResolved)}
                  className={`px-2.5 py-1  text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                    disc.isResolved
                      ? 'bg-surface1 hover:bg-surface2 text-subtext0'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                  }`}
                >
                  <CheckCircle2 className={`w-3 h-3 ${disc.isResolved ? '' : 'text-white'}`} />
                  <span className={disc.isResolved ? '' : 'text-white'}>{disc.isResolved ? 'Resolved' : 'Resolve'}</span>
                </button>
              </div>
            </div>

            {/* THREAD BODY & REPLIES */}
            {!isCollapsed && (
              <div className="p-3.5 space-y-3">
                <DiscussionThread key={disc.id} session={session} discussion={disc} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
