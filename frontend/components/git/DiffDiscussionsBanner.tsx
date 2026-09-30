import React, { useState } from 'react';
import {
  MessageSquare,
  Bot,
  User,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Plus,
  Send,
  X,
  ChevronDown,
  ChevronRight,
  Code2,
} from 'lucide-react';
import { useVirtualMrStore } from '../../store/useVirtualMrStore';
import { useGitStore } from '../../store/useGitStore';
import { openFileInEditor } from '../../utils/fileActions';
import { ChangedFile } from '../../types/git';
import { ReviewActionType } from '../../types/virtualMr';
import { MarkdownEditor } from '../common/MarkdownEditor';
import { MarkdownPreview } from '../common/MarkdownPreview';

interface Props {
  selectedFile: ChangedFile;
}

export const DiffDiscussionsBanner: React.FC<Props> = ({ selectedFile }) => {
  const { currentRepo, showToast } = useGitStore();
  const {
    getActiveSession,
    createDiscussion,
    replyToDiscussion,
    resolveDiscussion,
    reverifyDiscussionFix,
  } = useVirtualMrStore();

  const session = getActiveSession();
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [targetLine, setTargetLine] = useState<number>(1);
  const [commentText, setCommentText] = useState('');
  const commentAction: ReviewActionType = 'comment';
  const [replyInputs, setReplyInputs] = useState<{ [discId: string]: string }>({});
  const [verifyingDiscId, setVerifyingDiscId] = useState<string | null>(null);
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
    if (!commentText.trim()) return;

    await createDiscussion(session.id, {
      filePath: selectedFile.path,
      lineNumber: targetLine || 1,
      diffSide: 'right',
      initialComment: commentText.trim(),
      reviewAction: commentAction,
    });

    setCommentText('');
    setIsAddingComment(false);
    showToast('Review comment added');
  };

  const handleReply = async (discId: string) => {
    const text = replyInputs[discId]?.trim();
    if (!text) return;

    await replyToDiscussion(discId, text);
    setReplyInputs((prev) => ({ ...prev, [discId]: '' }));
    showToast('Reply posted');
  };

  const handleReverify = async (discId: string, botId?: string) => {
    setVerifyingDiscId(discId);
    try {
      await reverifyDiscussionFix(discId, botId || 'security-bot');
      showToast('AI Bot re-verified and approved the fix!');
    } catch (err: any) {
      showToast(`Re-verification error: ${err}`);
    } finally {
      setVerifyingDiscId(null);
    }
  };

  const toggleCollapse = (id: string) => {
    setCollapsedDiscIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="mb-3 space-y-2 text-xs">
      {/* HEADER BAR FOR FILE DISCUSSIONS */}
      <div className="flex items-center justify-between p-2 rounded-lg bg-surface0/60 border border-surface1 text-text">
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
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-surface1 hover:bg-surface2 text-text font-medium text-[11px] transition-colors cursor-pointer"
            title="Open this file in VS Code to edit code"
          >
            <Code2 className="w-3 h-3 text-subtext0" />
            <span>Open in IDE</span>
          </button>
          <button
            type="button"
            onClick={() => setIsAddingComment(!isAddingComment)}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-brand hover:bg-brand/90 text-[#11111b] font-semibold text-[11px] transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-3 h-3" />
            <span>Add Comment</span>
          </button>
        </div>
      </div>

      {/* NEW COMMENT FORM */}
      {isAddingComment && (
        <div className="p-3.5 rounded-lg bg-crust border border-surface0 space-y-2.5 shadow-md">
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
                className="w-16 px-2 py-1 rounded bg-surface0 border border-surface1 text-text text-xs focus:outline-none"
              />
            </div>
          </div>

          <MarkdownEditor
            value={commentText}
            onChange={setCommentText}
            placeholder="Enter review comment (Markdown supported)..."
            rows={3}
            minHeight="80px"
            showActions={true}
            onSubmit={handleCreateDiscussion}
            submitLabel="Submit Comment"
            onCancel={() => setIsAddingComment(false)}
            cancelLabel="Cancel"
          />
        </div>
      )}

      {/* DISCUSSIONS LIST */}
      {fileDiscussions.map((disc) => {
        const firstComment = disc.comments[0];
        const isCollapsed = collapsedDiscIds[disc.id] || disc.isResolved;
        const isVerifying = verifyingDiscId === disc.id || disc.verificationStatus === 'verifying';

        return (
          <div
            key={disc.id}
            className={`rounded-lg border transition-colors shadow-xs ${
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
                  <span className="font-mono font-bold text-accent px-1.5 py-0.2 rounded bg-surface0 text-[11px]">
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
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-500/20 text-red-400 font-mono font-semibold">
                    REQUEST CHANGES
                  </span>
                ) : firstComment?.reviewAction === 'approve' ? (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-mono font-semibold">
                    APPROVED
                  </span>
                ) : null}

                {/* Verification Badge */}
                {disc.resolveType === 'ai_verified' && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> AI-Verified
                  </span>
                )}
              </div>

              {/* Thread Action Controls */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Hand-off: Open in IDE at exact line */}
                <button
                  type="button"
                  onClick={() => handleOpenInIde(disc.lineNumber)}
                  className="px-2 py-0.5 rounded bg-surface0 hover:bg-surface1 text-text text-[11px] font-mono flex items-center gap-1 cursor-pointer"
                  title={`Open file at line ${disc.lineNumber || 1} in VS Code to edit code`}
                >
                  <ExternalLink className="w-3 h-3 text-subtext0" />
                  <span>Open in IDE</span>
                </button>

                {/* AI Re-verify Fix Button */}
                {!disc.isResolved && (
                  <button
                    type="button"
                    disabled={isVerifying}
                    onClick={() => handleReverify(disc.id, disc.verifiedByBot || undefined)}
                    className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-xs"
                    title="Request AI Bot to re-scan the code line after dev made fixes in IDE"
                  >
                    <RefreshCw className={`w-3 h-3 text-white ${isVerifying ? 'animate-spin' : ''}`} />
                    <span className="text-white">Re-verify Fix</span>
                  </button>
                )}

                {/* Resolve / Unresolve Toggle */}
                <button
                  type="button"
                  onClick={() => resolveDiscussion(disc.id, !disc.isResolved)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
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
                {/* First Comment Body */}
                <div className="text-xs text-text pl-1 leading-relaxed">
                  <MarkdownPreview content={firstComment?.body || ''} />
                </div>

                {/* Replies */}
                {disc.comments.slice(1).map((rep) => (
                  <div key={rep.id} className="ml-4 pl-3 border-l-2 border-surface1 py-1 space-y-1">
                    <div className="flex items-center gap-2 text-[11px]">
                      {rep.authorType === 'ai_agent' ? (
                        <Bot className="w-3 h-3 text-purple-400" />
                      ) : (
                        <User className="w-3 h-3 text-accent" />
                      )}
                      <span className="font-semibold text-text">{rep.authorName}</span>
                      <span className="text-subtext0 font-mono text-[10px]">
                        {new Date(rep.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-xs text-text pl-1 leading-relaxed">
                      <MarkdownPreview content={rep.body} />
                    </div>
                  </div>
                ))}

                {/* Reply Form */}
                <div className="flex items-center gap-2 pt-1 border-t border-surface0/60">
                  <input
                    type="text"
                    placeholder="Reply to this discussion..."
                    value={replyInputs[disc.id] || ''}
                    onChange={(e) => setReplyInputs({ ...replyInputs, [disc.id]: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleReply(disc.id);
                      }
                    }}
                    className="flex-1 px-3 py-1 rounded bg-surface0 border border-surface1 text-text text-xs focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleReply(disc.id)}
                    className="px-3 py-1 rounded bg-surface1 hover:bg-surface2 text-text font-medium text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Send className="w-3 h-3" />
                    <span>Reply</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
