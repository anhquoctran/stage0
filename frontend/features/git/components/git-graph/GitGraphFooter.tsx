import React from 'react';

export const GitGraphFooter: React.FC<{
    hasSearchFilter: boolean;
    displayedCount: number;
    isTruncated: boolean | undefined;
    totalCount: number;
}> = ({ hasSearchFilter, displayedCount, isTruncated, totalCount }) => {
    return (
        <footer className="flex shrink-0 items-center justify-between border-t border-surface0 px-5 py-2.5 text-[10px] text-subtext0">
            <span>
                {hasSearchFilter
                    ? `${displayedCount} search result${displayedCount === 1 ? '' : 's'}`
                    : isTruncated
                      ? 'Showing the latest 200 commits'
                      : `${totalCount} commits`}
                {' · '}Read-only history for the checked-out branch.
            </span>
            <span>
                Press Enter to find next · Shift+Enter to find previous
            </span>
        </footer>
    );
};

