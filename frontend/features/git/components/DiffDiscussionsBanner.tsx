import React, { useRef, useState } from 'react';
import { MessageSquare } from '../../../common/components/icons/MessageSquare';
import { Plus } from '../../../common/components/icons/Plus';
import { X } from '../../../common/components/icons/X';
import { Code2 } from '../../../common/components/icons/Code2';
import { useVirtualMrStore } from '../../virtual-mr/store/useVirtualMrStore';
import { useGitStore } from '../store/useGitStore';
import { openFileInEditor } from '../utils/fileActions';
import { type ReviewActionType } from '../../virtual-mr/types/ReviewActionType';
import { MarkdownEditor } from '../../../common/components/MarkdownEditor';
import { DiscussionThread } from '../../virtual-mr/components/DiscussionThread';
import { getDiscussionMentionOptions } from '../../virtual-mr/utils/discussionMentions';
import type { DiffDiscussionsBannerProps } from '../types/DiffDiscussionsBannerProps';

export const DiffDiscussionsBanner: React.FC<DiffDiscussionsBannerProps> = ({ selectedFile }) => {
  const { currentRepo, showToast } = useGitStore();
  const { getActiveSession, createDiscussion } = useVirtualMrStore();

  const session = getActiveSession();
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [targetLine, setTargetLine] = useState<number>(1);
  const [commentText, setCommentText] = useState('');
  const [isPostingDiscussion, setIsPostingDiscussion] = useState(false);
  const postingDiscussionRef = useRef(false);
  const commentAction: ReviewActionType = 'comment';

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

  return (
    <div className="mb-3 space-y-3 text-xs">
      {/* HEADER BAR FOR FILE DISCUSSIONS */}
      <div className="flex items-center justify-between p-2.5 bg-surface0/60 border border-surface1 text-text shadow-xs rounded-sm">
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
            className="flex items-center gap-1 px-2.5 py-1 bg-surface1 hover:bg-surface2 text-text font-medium text-[11px] transition-colors cursor-pointer rounded-sm"
            title="Open this file in VS Code to edit code"
          >
            <Code2 className="w-3 h-3 text-subtext0" />
            <span>Open in IDE</span>
          </button>
          {!selectedFile.is_binary && (
            <button
              type="button"
              onClick={() => setIsAddingComment(!isAddingComment)}
              className="flex items-center gap-1 px-2.5 py-1 bg-brand hover:bg-brand/90 text-on-accent font-semibold text-[11px] transition-colors cursor-pointer shadow-xs rounded-sm"
            >
              <Plus className="w-3 h-3" />
              <span>Add Comment</span>
            </button>
          )}
        </div>
      </div>

      {selectedFile.is_binary && (
        <div className="px-3 py-2 bg-surface0/50 border border-surface1 text-subtext0 rounded-sm">
          Line comments are unavailable for binary files. Existing discussions are retained below.
        </div>
      )}

      {/* NEW COMMENT FORM */}
      {isAddingComment && !selectedFile.is_binary && (
        <div className="p-3.5 bg-crust border border-surface0 space-y-2.5 shadow-md rounded-sm">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-xs text-text">Add review comment on code line</span>
            <button
              type="button"
              onClick={() => setIsAddingComment(false)}
              className="text-subtext0 hover:text-text cursor-pointer rounded-sm"
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
                className="w-16 px-2 py-1 bg-surface0 border border-surface1 text-text text-xs focus:outline-none rounded-sm"
              />
            </div>
          </div>

          <MarkdownEditor
            value={commentText}
            mentionOptions={getDiscussionMentionOptions(session)}
            onChange={setCommentText}
            placeholder="Enter review comment (Markdown supported)..."
            rows={5}
            minHeight="140px"
            maxHeight="500px"
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

      {/* DISCUSSIONS LIST (GitLab Card Style) */}
      <div className="space-y-3.5">
        {fileDiscussions.map((disc) => (
          <DiscussionThread key={disc.id} session={session} discussion={disc} />
        ))}
      </div>
    </div>
  );
};
