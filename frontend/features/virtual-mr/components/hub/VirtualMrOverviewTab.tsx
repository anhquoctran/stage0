import { MarkdownEditor } from '../../../../common/components/MarkdownEditor';
import { MarkdownPreview } from '../../../../common/components/MarkdownPreview';
import { getDiscussionMentionOptions } from '../../utils/discussionMentions';
import { MrDiscussionBoard } from '../MrDiscussionBoard';
import type { VirtualMrOverviewTabProps } from './VirtualMrOverviewTabProps';

export function VirtualMrOverviewTab({
  isEditingDesc,
  setIsEditingDesc,
  session,
  descValue,
  setDescValue,
  handleGenerateDescription,
  handleSaveDesc,
  newGeneralComment,
  setNewGeneralComment,
  handleAddGeneralComment,
  isPostingDiscussion,
}: VirtualMrOverviewTabProps) {
  return (
    <div className="p-4 bg-crust/50 border-b border-surface0 space-y-4 max-h-80 overflow-y-auto rounded-sm">
      {/* Description Section */}
      <div className="p-3.5 rounded-sm bg-mantle border border-surface0 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-xs text-subtext1">Description</span>
          {!isEditingDesc ? (
            <button
              type="button"
              onClick={() => setIsEditingDesc(true)}
              className="text-[11px] text-accent hover:underline cursor-pointer rounded-sm"
            >
              Edit Markdown
            </button>
          ) : session.description ? (
            <button
              type="button"
              onClick={() => setIsEditingDesc(false)}
              className="text-[11px] text-subtext0 hover:text-text cursor-pointer rounded-sm"
            >
              Preview
            </button>
          ) : null}
        </div>
        {isEditingDesc ? (
          <div className="space-y-2">
            <MarkdownEditor
              value={descValue}
              onChange={setDescValue}
              placeholder="Enter description here..."
              rows={4}
              minHeight="110px"
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
          <div className="p-3 bg-surface0/30 border border-surface0/60 leading-relaxed rounded-sm">
            <MarkdownPreview
              content={session.description}
              emptyPlaceholder="No description provided for this Virtual MR."
            />
          </div>
        )}
      </div>

      {/* General Discussions Timeline */}
      <div className="space-y-3">
        <MrDiscussionBoard session={session} />

        {/* Add general comment */}
        <div className="space-y-1.5 pt-1">
          <MarkdownEditor
            value={newGeneralComment}
            mentionOptions={getDiscussionMentionOptions(session)}
            onChange={setNewGeneralComment}
            placeholder="Write your comment here to start discussion..."
            rows={3}
            minHeight="80px"
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
}
