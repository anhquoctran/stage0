import { useTranslation as useUiTextTranslation } from 'react-i18next';
import { CustomSelect } from '../../../../common/components/CustomSelect';
import { MarkdownEditor } from '../../../../common/components/MarkdownEditor';
import { getDiscussionMentionOptions } from '../../utils/discussionMentions';
import type { DiscussionReplyBoxProps } from './DiscussionReplyBoxProps';

export function DiscussionReplyBox({
  isReplying,
  targetId,
  setTargetId,
  isSubmitting,
  discussion,
  rootComment,
  session,
  body,
  setBody,
  submit,
  resolveThread,
  isResolvable,
  setResolveThread,
  setIsReplying,
  setIsCollapsed,
  handleToggleResolve,
}: DiscussionReplyBoxProps) {
  const { t: translateUiText } = useUiTextTranslation();
  return (
    <div className="border-t border-surface0/80 p-3.5 bg-surface0/20 rounded-sm">
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
                {
                  value: discussion.id,
                  label: translateUiText('virtualMr.discussion.thisThread', {
                    summary: rootComment?.body.slice(0, 60) || discussion.id,
                  }),
                },
                { value: 'new', label: translateUiText('virtualMr.discussion.newGeneralDiscussion') },
                ...session.discussions
                  .filter((item) => item.id !== discussion.id)
                  .map((item) => ({
                    value: item.id,
                    label: translateUiText('virtualMr.discussion.locationAndSummary', {
                      location: item.filePath
                        ? `${item.filePath}:${item.lineNumber ?? 1}`
                        : translateUiText('virtualMr.discussion.general'),
                      summary: item.rootComment?.body.slice(0, 60) || item.id,
                    }),
                    description: item.id,
                  })),
              ]}
              aria-label={translateUiText('virtualMr.discussion.replyDestination')}
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
            rows={6}
            minHeight="150px"
            maxHeight="500px"
            autoFocus
            mentionOptions={getDiscussionMentionOptions(session)}
            placeholder={translateUiText('common.markdown.commentPlaceholder')}
            showActions={false}
            onSubmit={() => submit(resolveThread)}
            disabled={isSubmitting}
            isSubmitting={isSubmitting}
          />

          {/* Below editor: Resolve thread checkbox & action buttons (No rounded style) */}
          <div className="space-y-2.5 pt-0.5">
            {isResolvable && !discussion.isResolved && targetId === discussion.id && (
              <label className="inline-flex items-center gap-2 text-xs text-text cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={resolveThread}
                  onChange={(e) => setResolveThread(e.target.checked)}
                  className="border border-surface1 bg-crust text-blue focus:ring-0 cursor-pointer w-4 h-4"
                />
                <span>{translateUiText('virtualMr.discussion.resolveThread')}</span>
              </label>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => submit(resolveThread)}
                disabled={isSubmitting || !body.trim()}
                className="px-4 py-1.5 bg-blue hover:bg-blue/90 text-crust font-semibold text-xs shadow-xs disabled:opacity-50 transition-colors cursor-pointer rounded-sm"
              >
                {targetId === 'new'
                  ? translateUiText('virtualMr.discussion.startDiscussion')
                  : translateUiText('virtualMr.discussion.addCommentNow')}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsReplying(false);
                  setBody('');
                  setResolveThread(false);
                }}
                disabled={isSubmitting}
                className="px-3.5 py-1.5 border border-surface1 bg-surface1 hover:bg-surface2 text-text text-xs font-medium transition-colors cursor-pointer rounded-sm"
              >
                {translateUiText('common.cancel')}
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
            aria-label={translateUiText('virtualMr.discussion.replyToDiscussion', { id: discussion.id })}
            className="flex-1 text-start px-3 py-1.5 border border-surface1 bg-crust/50 hover:bg-crust hover:border-surface2 text-subtext0 hover:text-subtext1 text-xs transition-all cursor-text flex items-center shadow-inner rounded-sm"
          >
            <span>{translateUiText('virtualMr.discussion.replyPlaceholder')}</span>
          </button>

          {isResolvable && (
            <button
              type="button"
              onClick={handleToggleResolve}
              className="px-3 py-1.5 border border-surface1 bg-surface0 hover:bg-surface1 text-text text-xs font-medium flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer shrink-0 rounded-sm"
              title={translateUiText(discussion.isResolved
                ? 'virtualMr.discussion.reopenThreadTitle'
                : 'virtualMr.discussion.resolveThreadTitle')}
            >
              <span>{translateUiText(discussion.isResolved
                ? 'virtualMr.discussion.reopenThread'
                : 'virtualMr.discussion.resolveThread')}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
