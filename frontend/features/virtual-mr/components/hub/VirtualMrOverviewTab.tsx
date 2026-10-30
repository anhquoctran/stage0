import React, { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation as useUiTextTranslation } from 'react-i18next';
import { MarkdownEditor } from '../../../../common/components/MarkdownEditor';
import { MarkdownPreview } from '../../../../common/components/MarkdownPreview';
import { useGitStore } from '../../../git/store/useGitStore';
import { useReviewStore } from '../../../review/store/useReviewStore';
import { useVirtualMrStore } from '../../store/useVirtualMrStore';
import { getDiscussionMentionOptions } from '../../utils/discussionMentions';
import { VirtualMrActivityTimeline } from '../overview/VirtualMrActivityTimeline';
import { VirtualMrMergeDetails } from '../overview/VirtualMrMergeDetails';
import { VirtualMrOverviewSidebar } from '../overview/VirtualMrOverviewSidebar';
import type { VirtualMrOverviewTabProps } from './VirtualMrOverviewTabProps';

export const VirtualMrOverviewTab: React.FC<VirtualMrOverviewTabProps> = ({ session }) => {
  const { t: translateUiText } = useUiTextTranslation();
  const isGeneratingDescription = useReviewStore((state) =>
    state.reviewBatches[session.id]?.phase === 'preparing-description');
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
    if (isGeneratingDescription) setIsEditingDesc(false);
  }, [isGeneratingDescription]);

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
    if (isGeneratingDescription) return;
    await updateSessionDetails(session.id, session.title, descValue);
    showToast(translateUiText('virtualMr.overview.descriptionSaved'));
    setIsEditingDesc(false);
  };

  const handleGenerateDescription = () => {
    if (!session) return;
    setIsEditingDesc(true);
    const commitList =
      session.commits.length > 0
        ? session.commits.map((c) => `- ${c.subject} (\`${c.shortHash}\`)`).join('\n')
        : `- ${translateUiText('virtualMr.overview.ongoingChanges')}`;

    const draft = [
      `## ${translateUiText('virtualMr.overview.summaryHeading')}`,
      `${translateUiText('virtualMr.overview.automatedOverviewFor')} \`${session.compareBranch}\` → \`${session.baseBranch}\`.`,
      '',
      `### ${translateUiText('virtualMr.overview.keyChangesHeading')}`,
      commitList,
      '',
      `### ${translateUiText('virtualMr.overview.testingHeading')}`,
      `- [ ] ${translateUiText('virtualMr.overview.aiReviewChecksVerified')}`,
      `- [ ] ${translateUiText('virtualMr.overview.localBuildTestsPass')}`,
      '',
    ].join('\n');

    if (descValue.trim() && descValue.trim() !== draft.trim()) {
      if (window.confirm(translateUiText('virtualMr.overview.replaceDescriptionConfirmation'))) {
        setDescValue(draft);
        showToast(translateUiText('virtualMr.overview.generatedDescriptionFromCommits'));
      }
    } else {
      setDescValue(draft);
      showToast(translateUiText('virtualMr.overview.generatedDescriptionFromCommits'));
    }
  };

  const handleAddGeneralComment = async () => {
    if (!newGeneralComment.trim() || postingDiscussionRef.current) return;
    postingDiscussionRef.current = true;
    setIsPostingDiscussion(true);
    try {
      await createDiscussion(session.id, { initialComment: newGeneralComment.trim() });
      setNewGeneralComment('');
      showToast(translateUiText('virtualMr.overview.discussionPosted'), 'success');
    } catch (error) {
      showToast(
        translateUiText('virtualMr.overview.discussionPostFailed', { error: error instanceof Error ? error.message : String(error) }),
        'error'
      );
    } finally {
      postingDiscussionRef.current = false;
      setIsPostingDiscussion(false);
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-crust/30 w-full">
      <div className="w-full flex flex-col lg:flex-row min-h-full">
        {/* Main Column */}
        <div className="flex-1 min-w-0 p-6 space-y-6">
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
              <span className="font-semibold text-xs text-text">{translateUiText('virtualMr.overview.description')}</span>
              {isGeneratingDescription ? null : !isEditingDesc ? (
                <button
                  type="button"
                  onClick={() => setIsEditingDesc(true)}
                  className="text-xs text-primary hover:underline cursor-pointer rounded-sm"
                >
                  {translateUiText('virtualMr.overview.editDescription')}
                </button>
              ) : session.description ? (
                <button
                  type="button"
                  onClick={() => setIsEditingDesc(false)}
                  className="text-xs text-subtext0 hover:text-text cursor-pointer rounded-sm"
                >
                  {translateUiText('virtualMr.overview.cancelEdit')}
                </button>
              ) : null}
            </div>

            {isGeneratingDescription ? (
              <div role="status" aria-live="polite" aria-busy="true" className="space-y-3 rounded-sm bg-mantle p-4">
                <p className="text-xs text-subtext0">{translateUiText('virtualMr.reviews.summarizingFiles')}</p>
                <div aria-hidden="true" className="space-y-2 motion-safe:animate-pulse">
                  <div className="h-4 w-1/3 rounded-sm bg-surface1" />
                  <div className="h-3 w-full rounded-sm bg-surface0" />
                  <div className="h-3 w-5/6 rounded-sm bg-surface0" />
                  <div className="h-3 w-2/3 rounded-sm bg-surface0" />
                </div>
              </div>
            ) : isEditingDesc ? (
              <div className="space-y-2">
                <MarkdownEditor
                  value={descValue}
                  onChange={setDescValue}
                  placeholder={translateUiText('virtualMr.overview.descriptionPlaceholder')}
                  rows={12}
                  minHeight="280px"
                  maxHeight="650px"
                  showActions={true}
                  onGenerateDraft={handleGenerateDescription}
                  onSubmit={handleSaveDesc}
                  submitLabel={translateUiText('virtualMr.overview.saveDescription')}
                  onCancel={() => {
                    setDescValue(session.description);
                    setIsEditingDesc(false);
                  }}
                  cancelLabel={translateUiText('common.cancel')}
                />
              </div>
            ) : (
              <div className="pt-1 leading-relaxed text-xs">
                <MarkdownPreview
                  content={session.description}
                  emptyPlaceholder={translateUiText('virtualMr.overview.emptyDescription')}
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
            <span className="font-semibold text-xs text-text">{translateUiText('virtualMr.overview.leaveComment')}</span>
            <p className="text-[11px] leading-relaxed text-subtext0">
              <Trans
                i18nKey="virtualMr.overview.requestReviewGuide"
                components={{ command: <code className="rounded-sm bg-surface0 px-1" /> }}
              />
            </p>
            <MarkdownEditor
              value={newGeneralComment}
              mentionOptions={getDiscussionMentionOptions(session)}
              onChange={setNewGeneralComment}
              placeholder={translateUiText('virtualMr.overview.commentPlaceholder')}
              rows={6}
              minHeight="160px"
              maxHeight="500px"
              showActions={true}
              onSubmit={handleAddGeneralComment}
              submitLabel={translateUiText('virtualMr.overview.postComment')}
              disabled={isPostingDiscussion}
              isSubmitting={isPostingDiscussion}
            />
          </div>
        </div>

        {/* Right Sidebar (Metadata: Assignee, Reviewers, Labels, Participants) */}
        <div className="w-full lg:w-72 xl:w-80 shrink-0 border-t lg:border-t-0 lg:border-s border-surface0/60 bg-mantle/30 p-5">
          <VirtualMrOverviewSidebar session={session} />
        </div>
      </div>
    </div>
  );
};
