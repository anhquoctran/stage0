import React, { useEffect, useRef, useState } from 'react';
import { MarkdownEditor } from '../../../../common/components/MarkdownEditor';
import { MarkdownPreview } from '../../../../common/components/MarkdownPreview';
import { useGitStore } from '../../../git/store/useGitStore';
import { useVirtualMrStore } from '../../store/useVirtualMrStore';
import { getDiscussionMentionOptions } from '../../utils/discussionMentions';
import { VirtualMrActivityTimeline } from '../overview/VirtualMrActivityTimeline';
import { VirtualMrMergeDetails } from '../overview/VirtualMrMergeDetails';
import type { VirtualMrOverviewTabProps } from './VirtualMrOverviewTabProps';

export const VirtualMrOverviewTab: React.FC<VirtualMrOverviewTabProps> = ({ session }) => {
  const { showToast } = useGitStore();
  const { updateSessionDetails, createDiscussion, consumeDescriptionEditRequest } =
    useVirtualMrStore();

  const isLegacyBoilerplate = (desc?: string) =>
    Boolean(
      desc &&
        desc.includes('Virtual MR comparing') &&
        (desc.includes('Review code changes') || desc.includes('Check security'))
    );

  const [descValue, setDescValue] = useState(() => {
    const raw = session?.description || '';
    return isLegacyBoilerplate(raw) ? '' : raw;
  });
  const [isEditingDesc, setIsEditingDesc] = useState(false);

  const [newGeneralComment, setNewGeneralComment] = useState('');
  const [isPostingDiscussion, setIsPostingDiscussion] = useState(false);
  const postingDiscussionRef = useRef(false);

  useEffect(() => {
    if (!session) return;
    setIsEditingDesc(consumeDescriptionEditRequest(session.id));
  }, [session?.id, consumeDescriptionEditRequest]);

  useEffect(() => {
    if (!session) return;
    if (isLegacyBoilerplate(session.description)) {
      void updateSessionDetails(session.id, session.title, '');
      setDescValue('');
    } else {
      setDescValue(session.description || '');
    }
  }, [session?.id, session?.description, session?.title, updateSessionDetails]);

  const handleSaveDesc = async () => {
    await updateSessionDetails(session.id, session.title, descValue);
    showToast('Description saved');
    setIsEditingDesc(false);
  };

  const handleGenerateDescription = () => {
    if (!session) return;
    setIsEditingDesc(true);
    const commitList =
      session.commits.length > 0
        ? session.commits.map((c) => `- ${c.subject} (\`${c.shortHash}\`)`).join('\n')
        : '- Ongoing changes between branches';

    const draft = `## Summary\nAutomated overview for \`${session.compareBranch}\` → \`${session.baseBranch}\`.\n\n### Key Changes\n${commitList}\n\n### Testing & Verification\n- [ ] AI review checks verified\n- [ ] Local build & tests pass\n`;

    if (descValue.trim() && descValue.trim() !== draft.trim()) {
      if (window.confirm('Replace current description with a draft from commit metadata?')) {
        setDescValue(draft);
        showToast('Generated description from commit metadata. No AI request was sent.');
      }
    } else {
      setDescValue(draft);
      showToast('Generated description from commit metadata. No AI request was sent.');
    }
  };

  const handleAddGeneralComment = async () => {
    if (!newGeneralComment.trim() || postingDiscussionRef.current) return;
    postingDiscussionRef.current = true;
    setIsPostingDiscussion(true);
    try {
      await createDiscussion(session.id, { initialComment: newGeneralComment.trim() });
      setNewGeneralComment('');
      showToast('Discussion posted', 'success');
    } catch (error) {
      showToast(
        `Could not post discussion: ${error instanceof Error ? error.message : String(error)}`,
        'error'
      );
    } finally {
      postingDiscussionRef.current = false;
      setIsPostingDiscussion(false);
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto px-6 py-6 bg-crust/30 w-full">
      <div className="w-full space-y-6">
        {/* Merge Details Card */}
        <VirtualMrMergeDetails session={session} />

        {/* Description Section */}
        <div
          className={
            isEditingDesc
              ? 'p-4 rounded-sm bg-mantle border border-surface0 space-y-3'
              : 'space-y-2'
          }
        >
          <div className="flex items-center justify-between border-b border-surface0/60 pb-2">
            <span className="font-semibold text-xs text-text">Description</span>
            {!isEditingDesc ? (
              <button
                type="button"
                onClick={() => setIsEditingDesc(true)}
                className="text-xs text-primary hover:underline cursor-pointer rounded-sm"
              >
                Edit Description
              </button>
            ) : session.description ? (
              <button
                type="button"
                onClick={() => setIsEditingDesc(false)}
                className="text-xs text-subtext0 hover:text-text cursor-pointer rounded-sm"
              >
                Cancel Edit
              </button>
            ) : null}
          </div>

          {isEditingDesc ? (
            <div className="space-y-2">
              <MarkdownEditor
                value={descValue}
                onChange={setDescValue}
                placeholder="Enter MR overview, motivations, or checklist..."
                rows={6}
                minHeight="140px"
                showActions={true}
                onGenerateDraft={handleGenerateDescription}
                onSubmit={handleSaveDesc}
                submitLabel="Save Description"
                onCancel={() => {
                  setDescValue(session.description);
                  setIsEditingDesc(false);
                }}
                cancelLabel="Cancel"
              />
            </div>
          ) : (
            <div className="pt-1 leading-relaxed text-xs">
              <MarkdownPreview
                content={session.description}
                emptyPlaceholder="No description provided for this Virtual MR."
              />
            </div>
          )}
        </div>

        {/* Activity Section (Timeline of events + discussions) */}
        <div className="pt-2">
          <VirtualMrActivityTimeline session={session} />
        </div>

        {/* Leave a Comment Box */}
        <div className="p-4 rounded-sm bg-mantle border border-surface0 space-y-2">
          <span className="font-semibold text-xs text-text">Leave a Comment</span>
          <MarkdownEditor
            value={newGeneralComment}
            mentionOptions={getDiscussionMentionOptions(session)}
            onChange={setNewGeneralComment}
            placeholder="Write your comment or mention a reviewer with @..."
            rows={4}
            minHeight="100px"
            showActions={true}
            onSubmit={handleAddGeneralComment}
            submitLabel="Post Comment"
            disabled={isPostingDiscussion}
            isSubmitting={isPostingDiscussion}
          />
        </div>
      </div>
    </div>
  );
};
