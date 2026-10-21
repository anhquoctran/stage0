import React from 'react';
import { GitBranch } from '../../../../common/components/icons/GitBranch';
import { RotateCw } from '../../../../common/components/icons/RotateCw';
import { X } from '../../../../common/components/icons/X';

export const GitGraphHeader: React.FC<{
    branch: string | undefined;
    isDetached: boolean | undefined;
    isLoading: boolean;
    onRefresh: () => void;
    onClose: () => void;
}> = ({ branch, isDetached, isLoading, onRefresh, onClose }) => {
    return (
        <header className="flex shrink-0 items-center justify-between border-b border-surface0 bg-base/60 px-5 py-3.5">
            <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-surface1 bg-surface0 text-brand">
                    <GitBranch className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                    <h2
                        id="git-graph-title"
                        className="text-sm font-bold text-text"
                    >
                        Git Graph
                    </h2>
                    <p className="truncate text-[11px] text-subtext0">
                        Current branch:{' '}
                        <span className="font-mono font-semibold text-text">
                            {branch || 'Loading…'}
                        </span>
                        {isDetached && (
                            <span className="ml-1">(detached)</span>
                        )}
                    </p>
                </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
                <button
                    type="button"
                    onClick={onRefresh}
                    disabled={isLoading}
                    aria-label="Refresh Git Graph"
                    title="Refresh Git Graph"
                    className="flex h-8 w-8 items-center justify-center text-subtext0 transition-colors hover:bg-surface0 hover:text-text disabled:opacity-40"
                >
                    <RotateCw
                        className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
                    />
                </button>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close Git Graph"
                    title="Close (Esc)"
                    className="flex h-8 w-8 items-center justify-center text-subtext0 transition-colors hover:bg-surface0 hover:text-text"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </header>
    );
};

