import { useTranslation } from 'react-i18next';
import { MarkdownEditor } from '../../../../common/components/MarkdownEditor';
import type { MarkdownEditorProps } from '../../../../common/types/MarkdownEditorProps';
import { useDiscussionEntityOptions } from '../../hooks/useDiscussionEntityOptions';
import type { VirtualMrSession } from '../../types/VirtualMrSession';
import { getDiscussionMentionOptions } from '../../utils/discussionMentions';
import { DiscussionEntityLinks } from './DiscussionEntityLinks';

export function DiscussionMarkdownEditor({
    session,
    ...props
}: Omit<MarkdownEditorProps, 'mentionOptions' | 'onMentionQueryChange'> & {
    session: VirtualMrSession;
}) {
    const { t } = useTranslation();
    const { options, requestHistory, historyUnavailable, retryHistory } =
        useDiscussionEntityOptions(session);
    return (
        <DiscussionEntityLinks session={session}>
            <MarkdownEditor
                {...props}
                mentionOptions={[
                    ...getDiscussionMentionOptions(session),
                    ...options,
                ]}
                onMentionQueryChange={requestHistory}
            />
            {historyUnavailable && (
                <p role="status" className="mt-1 text-xs text-subtext0">
                    {t('virtualMr.discussion.referenceHistoryUnavailable')}{' '}
                    <button
                        type="button"
                        onClick={retryHistory}
                        className="rounded-sm text-primary hover:underline"
                    >
                        {t('common.errorBoundary.tryAgain')}
                    </button>
                </p>
            )}
        </DiscussionEntityLinks>
    );
}
