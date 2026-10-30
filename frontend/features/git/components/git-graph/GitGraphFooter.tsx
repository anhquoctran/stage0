import React from 'react';
import { useTranslation } from 'react-i18next';

export const GitGraphFooter: React.FC<{
    hasSearchFilter: boolean;
    displayedCount: number;
    isTruncated: boolean | undefined;
    totalCount: number;
}> = ({ hasSearchFilter, displayedCount, isTruncated, totalCount }) => {
    const { t } = useTranslation();
    return (
        <footer className="flex shrink-0 items-center justify-between border-t border-surface0 px-5 py-2.5 text-[10px] text-subtext0">
            <span>
                {hasSearchFilter
                    ? t('git.graphFooter.searchResults', { count: displayedCount })
                    : isTruncated
                      ? t('git.graphFooter.latestCommits')
                      : t('git.graphFooter.commitCount', { count: totalCount })}
                {' · '}{t('git.graphFooter.readOnlyHistory')}
            </span>
            <span>
                {t('git.graphFooter.searchNavigation')}
            </span>
        </footer>
    );
};

