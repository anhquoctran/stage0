import React from 'react';
import { useTranslation as useUiTextTranslation } from 'react-i18next';
import { Copy } from '../../../common/components/icons/Copy';
import { GitBranch } from '../../../common/components/icons/GitBranch';
import { formatDateTime } from '@/common/utils/dateTime';
import { useDateTimeLanguage } from '../../i18n/hooks/useDateTimeLanguage';
import { CommitAuthorAvatar } from './CommitAuthorAvatar';
import type { GitGraphCommit } from '../types/GitGraphCommit';

export const GitGraphCommitDetails: React.FC<{
    selectedCommit: GitGraphCommit | null;
    selectedCommitMessage: string | null;
    isLoadingCommitMessage: boolean;
    commitMessageError: string | null;
    handleCopyCommitHash: (hash: string) => void | Promise<void>;
    referenceColor: (reference: string) => string;
}> = ({
    selectedCommit,
    selectedCommitMessage,
    isLoadingCommitMessage,
    commitMessageError,
    handleCopyCommitHash,
    referenceColor,
}) => {
    const { t: translateUiText } = useUiTextTranslation();
    useDateTimeLanguage();
    return (
        <aside className="flex w-[min(36%,440px)] min-w-[300px] shrink-0 flex-col border-s border-surface0 bg-base/40">
            {selectedCommit ? (
                <>
                    <div className="shrink-0 border-b border-surface0 px-4 py-3 rounded-sm">
                        <div className="flex items-center justify-between gap-2">
                            <h3 className="text-[11px] font-bold uppercase tracking-wider text-subtext0">
                                {translateUiText('git.commitDetails.title')}
                            </h3>
                            <span className="shrink-0 font-mono text-[10px] text-subtext0">
                                {selectedCommit.short_hash}
                            </span>
                        </div>
                        <p className="mt-2 break-words text-sm font-semibold leading-5 text-text">
                            {selectedCommit.subject || translateUiText('git.commitDetails.noMessage')}
                        </p>
                        {selectedCommit.refs.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                                {selectedCommit.refs.map((reference) => (
                                    <span
                                        key={reference}
                                        style={{
                                            color: referenceColor(reference),
                                            borderColor: referenceColor(reference),
                                            backgroundColor: `color-mix(in srgb, ${referenceColor(reference)} 12%, var(--color-surface0))`,
                                        }}
                                        className="max-w-full truncate border px-1.5 py-0.5 font-mono text-[10px]"
                                    >
                                        {reference}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
                        <dl className="space-y-3 text-xs">
                            <div>
                                <dt className="text-[10px] font-semibold uppercase tracking-wide text-subtext0">
                                    {translateUiText('git.commitDetails.author')}
                                </dt>
                                <dd className="mt-2 flex min-w-0 items-center gap-3 text-text">
                                    <CommitAuthorAvatar
                                        name={selectedCommit.author_name || translateUiText('git.commitDetails.unknownAuthor')}
                                        email={selectedCommit.author_email}
                                    />
                                    <span className="min-w-0 break-words">
                                        {selectedCommit.author_name || translateUiText('git.commitDetails.unknownAuthor')}
                                        {selectedCommit.author_email && (
                                            <span className="block break-all text-subtext0">
                                                {selectedCommit.author_email}
                                            </span>
                                        )}
                                    </span>
                                </dd>
                            </div>
                            <div>
                                <dt className="text-[10px] font-semibold uppercase tracking-wide text-subtext0">
                                    {translateUiText('git.commitDetails.date')}
                                </dt>
                                <dd className="mt-0.5 text-text">
                                    {formatDateTime(selectedCommit.authored_date) || '—'}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-[10px] font-semibold uppercase tracking-wide text-subtext0">
                                    {translateUiText('git.commitDetails.commit')}
                                </dt>
                                <dd className="mt-0.5 flex min-w-0 items-start gap-2 font-mono text-[11px] text-text">
                                    <span className="min-w-0 flex-1 break-all">
                                        {selectedCommit.hash}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => void handleCopyCommitHash(selectedCommit.hash)}
                                        aria-label={translateUiText('git.commitDetails.copyHash')}
                                        title={translateUiText('git.commitDetails.copyHash')}
                                        className="flex h-6 w-6 shrink-0 items-center justify-center text-subtext0 hover:bg-surface0 hover:text-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand cursor-pointer rounded-sm"
                                    >
                                        <Copy className="h-3.5 w-3.5" />
                                    </button>
                                </dd>
                            </div>
                            <div>
                                <dt className="text-[10px] font-semibold uppercase tracking-wide text-subtext0">
                                    {translateUiText('git.commitDetails.parentsLabel')}
                                </dt>
                                <dd className="mt-0.5 space-y-1 font-mono text-[10px] text-text">
                                    {selectedCommit.parents.length > 0 ? (
                                        selectedCommit.parents.map((parent) => (
                                            <div key={parent} className="break-all">
                                                {parent}
                                            </div>
                                        ))
                                    ) : (
                                        <span className="text-subtext0">
                                            {translateUiText('git.commitDetails.rootCommit')}
                                        </span>
                                    )}
                                </dd>
                            </div>
                        </dl>

                        <div className="mt-5 border-t border-surface0 pt-3">
                            <h4 className="text-[10px] font-semibold uppercase tracking-wide text-subtext0">
                                {translateUiText('git.commitDetails.message')}
                            </h4>
                            <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-text select-text">
                                {isLoadingCommitMessage
                                    ? translateUiText('git.commitDetails.loadingMessage')
                                    : commitMessageError
                                      ? translateUiText('git.commitDetails.messageLoadFailed', { error: commitMessageError })
                                      : selectedCommitMessage || translateUiText('git.commitDetails.emptyMessage')}
                            </pre>
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                    <GitBranch className="h-5 w-5 text-subtext1" />
                    <p className="mt-2 text-xs font-semibold text-text">
                        {translateUiText('git.commitDetails.selectCommit')}
                    </p>
                    <p className="mt-1 text-[11px] leading-4 text-subtext0">
                        {translateUiText('git.commitDetails.selectCommitHint')}
                    </p>
                </div>
            )}
        </aside>
    );
};

