import React from 'react';
import { useTranslation as useUiTextTranslation } from 'react-i18next';
import { RotateCw } from '../../../../common/components/icons/RotateCw';
import { Search } from '../../../../common/components/icons/Search';
import { GitBranch } from '../../../../common/components/icons/GitBranch';
import { GitGraphTableRow } from './GitGraphTableRow';
import type { GitGraph } from '../../types/GitGraph';
import type { GitGraphCommit } from '../../types/GitGraphCommit';
import type { GraphRowLayout } from '../../types/GraphRowLayout';

export const GitGraphTable: React.FC<{
    graph: GitGraph | null;
    error: string | null;
    isLoading: boolean;
    hasSearchFilter: boolean;
    isSearchingWithoutMetadataMatches: boolean;
    query: string;
    graphWidth: number;
    commits: GitGraphCommit[];
    displayedCommitIndexes: number[];
    matchingCommitIndexes: number[];
    currentMatchCommit: GitGraphCommit | null;
    selectedCommitHash: string | null;
    graphLayout: { rows: GraphRowLayout[]; laneCount: number };
    onSelectCommit: (hash: string) => void;
    onContextMenu: (event: React.MouseEvent, hash: string) => void;
    onRowRef: (hash: string, element: HTMLTableRowElement | null) => void;
}> = ({
    graph,
    error,
    isLoading,
    hasSearchFilter,
    isSearchingWithoutMetadataMatches,
    query,
    graphWidth,
    commits,
    displayedCommitIndexes,
    matchingCommitIndexes,
    currentMatchCommit,
    selectedCommitHash,
    graphLayout,
    onSelectCommit,
    onContextMenu,
    onRowRef,
}) => {
    const { t: translateUiText } = useUiTextTranslation();
    return (
        <div className="min-w-0 flex-1 overflow-auto">
            {isLoading || (!graph && !error) ? (
                <div className="flex h-48 items-center justify-center gap-2 text-xs text-subtext0">
                    <RotateCw className="h-4 w-4 animate-spin" />
                    {translateUiText('git.graphTable.loading')}
                </div>
            ) : error ? (
                <div className="m-4 border border-red bg-red px-4 py-3 text-xs text-white rounded-sm">
                    {translateUiText('git.graphTable.loadFailed', { error })}
                </div>
            ) : hasSearchFilter && displayedCommitIndexes.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center gap-2 px-6 text-center">
                    {isSearchingWithoutMetadataMatches ? (
                        <>
                            <RotateCw className="h-5 w-5 animate-spin text-subtext1" />
                            <p className="text-sm font-semibold text-text">
                                {translateUiText('git.graphTable.searching')}
                            </p>
                        </>
                    ) : (
                        <>
                            <Search className="h-6 w-6 text-subtext1" />
                            <p className="text-sm font-semibold text-text">
                                {translateUiText('git.graphTable.noMatches')}
                            </p>
                            <p className="break-words text-xs text-subtext0">
                                {translateUiText('git.graphTable.noMatchesForQuery', { query: query.trim() })}
                            </p>
                        </>
                    )}
                </div>
            ) : !hasSearchFilter && commits.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
                    <GitBranch className="h-6 w-6 text-subtext1" />
                    <p className="text-sm font-semibold text-text">
                        {translateUiText('git.graphTable.noCommits')}
                    </p>
                    <p className="text-xs text-subtext0">
                        {translateUiText('git.graphTable.emptyBranch')}
                    </p>
                </div>
            ) : (
                <table className="w-full min-w-[920px] table-fixed border-collapse text-xs">
                    <colgroup>
                        <col style={{ width: graphWidth }} />
                        <col />
                        <col style={{ width: 178 }} />
                        <col style={{ width: 150 }} />
                        <col style={{ width: 92 }} />
                    </colgroup>
                    <thead className="sticky top-0 z-10 bg-mantle text-start text-[11px] font-semibold text-subtext1 shadow-sm">
                        <tr className="h-8 border-b border-surface0">
                            <th className="px-3">{translateUiText('git.graphTable.graph')}</th>
                            <th className="px-2">{translateUiText('git.graphTable.description')}</th>
                            <th className="px-2">{translateUiText('git.graphTable.date')}</th>
                            <th className="px-2">{translateUiText('git.graphTable.author')}</th>
                            <th className="px-2">{translateUiText('git.graphTable.commit')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayedCommitIndexes.map((index) => {
                            const commit = commits[index];
                            const row = graphLayout.rows[index];
                            const isMatch = matchingCommitIndexes.includes(index);
                            const isActiveMatch =
                                currentMatchCommit?.hash === commit.hash;

                            return (
                                <GitGraphTableRow
                                    key={commit.hash}
                                    commit={commit}
                                    row={row}
                                    graphWidth={graphWidth}
                                    hasSearchFilter={hasSearchFilter}
                                    isSelected={selectedCommitHash === commit.hash}
                                    isMatch={isMatch}
                                    isActiveMatch={isActiveMatch}
                                    onSelect={() => onSelectCommit(commit.hash)}
                                    onContextMenu={(event) => {
                                        event.preventDefault();
                                        onContextMenu(event, commit.hash);
                                    }}
                                    onRowRef={(element) =>
                                        onRowRef(commit.hash, element)
                                    }
                                />
                            );
                        })}
                    </tbody>
                </table>
            )}
        </div>
    );
};

