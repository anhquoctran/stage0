import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatDateTime } from '@/common/utils/dateTime';
import { useDateTimeLanguage } from '../../../i18n/hooks/useDateTimeLanguage';
import { CommitAuthorAvatar } from '../CommitAuthorAvatar';
import {
    ROW_HEIGHT,
    LANE_COLORS,
    laneX,
    referenceColor,
} from '../../constants/gitGraphConstants';
import type { GitGraphCommit } from '../../types/GitGraphCommit';
import type { GraphRowLayout } from '../../types/GraphRowLayout';

export const GitGraphTableRow: React.FC<{
    commit: GitGraphCommit;
    row: GraphRowLayout;
    graphWidth: number;
    hasSearchFilter: boolean;
    isSelected: boolean;
    isMatch: boolean;
    isActiveMatch: boolean;
    onSelect: () => void;
    onContextMenu: (event: React.MouseEvent) => void;
    onRowRef: (element: HTMLTableRowElement | null) => void;
}> = ({
    commit,
    row,
    graphWidth,
    hasSearchFilter,
    isSelected,
    isMatch,
    isActiveMatch,
    onSelect,
    onContextMenu,
    onRowRef,
}) => {
    const { t } = useTranslation();
    useDateTimeLanguage();
    const color = LANE_COLORS[row.lane % LANE_COLORS.length];

    return (
        <tr
            ref={onRowRef}
            onClick={onSelect}
            onContextMenu={onContextMenu}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect();
                }
            }}
            aria-selected={isSelected}
            tabIndex={0}
            className={`h-9 cursor-pointer border-b border-surface0/50 outline-none transition-colors hover:bg-surface0/70 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-brand ${
                isSelected
                    ? 'bg-brand/20'
                    : isActiveMatch
                      ? 'bg-brand/15'
                      : isMatch
                        ? 'bg-brand/10'
                        : ''
            }`}
        >
            <td className="px-3 py-0">
                <svg
                    width={graphWidth - 24}
                    height={ROW_HEIGHT}
                    viewBox={`0 0 ${graphWidth - 24} ${ROW_HEIGHT}`}
                    role="img"
                    aria-label={t('git.graphTable.laneLabel', { lane: row.lane + 1 })}
                    className="block"
                >
                    {hasSearchFilter ? (
                        <circle
                            cx={laneX(row.lane)}
                            cy="18"
                            r="4"
                            fill={color}
                        />
                    ) : (
                        <>
                            {row.throughLanes.map((lane) => (
                                <path
                                    key={`through-${lane}`}
                                    d={`M ${laneX(lane)} 0 V ${ROW_HEIGHT}`}
                                    fill="none"
                                    stroke={
                                        LANE_COLORS[lane % LANE_COLORS.length]
                                    }
                                    strokeWidth="2"
                                />
                            ))}
                            {row.hasIncomingEdge && (
                                <path
                                    d={`M ${laneX(row.lane)} 0 V 18`}
                                    fill="none"
                                    stroke={color}
                                    strokeWidth="2"
                                />
                            )}
                            {row.parentLanes.map((parentLane, parentIndex) => {
                                const startX = laneX(row.lane);
                                const endX = laneX(parentLane);
                                const path =
                                    startX === endX
                                        ? `M ${startX} 18 V ${ROW_HEIGHT}`
                                        : `M ${startX} 18 C ${startX} 27, ${endX} 27, ${endX} ${ROW_HEIGHT}`;
                                return (
                                    <path
                                        key={`parent-${parentIndex}-${parentLane}`}
                                        d={path}
                                        fill="none"
                                        stroke={
                                            LANE_COLORS[
                                                parentLane % LANE_COLORS.length
                                            ]
                                        }
                                        strokeWidth="2"
                                    />
                                );
                            })}
                            <circle
                                cx={laneX(row.lane)}
                                cy="18"
                                r="3.5"
                                fill={color}
                            />
                        </>
                    )}
                </svg>
            </td>
            <td className="overflow-hidden px-2 py-0">
                <div className="flex min-w-0 items-center gap-1.5">
                    {commit.refs.map((reference) => (
                        <span
                            key={reference}
                            title={reference}
                            style={{
                                color: referenceColor(reference),
                                borderColor: referenceColor(reference),
                                backgroundColor: `color-mix(in srgb, ${referenceColor(reference)} 12%, var(--color-surface0))`,
                            }}
                            className="max-w-48 shrink-0 truncate border px-1.5 py-0.5 font-mono text-[10px]"
                        >
                            {reference}
                        </span>
                    ))}
                    <span
                        className="truncate text-text"
                        title={commit.subject}
                    >
                        {commit.subject || t('git.graphTable.noCommitMessage')}
                    </span>
                </div>
            </td>
            <td
                className="truncate px-2 py-0 text-subtext1"
                title={commit.authored_date}
            >
                {formatDateTime(commit.authored_date) || '—'}
            </td>
            <td
                className="overflow-hidden px-2 py-0 text-subtext1"
                title={commit.author_name}
            >
                <div className="flex min-w-0 items-center gap-1.5">
                    <CommitAuthorAvatar
                        name={commit.author_name || t('git.graphTable.unknownAuthor')}
                        email={commit.author_email}
                        size={22}
                    />
                    <span className="truncate">
                        {commit.author_name || t('git.graphTable.unknownAuthor')}
                    </span>
                </div>
            </td>
            <td
                className="px-2 py-0 font-mono text-subtext1"
                title={commit.hash}
            >
                {commit.short_hash}
            </td>
        </tr>
    );
};

