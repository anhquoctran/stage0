import React from 'react';
import { Search } from '../../../../common/components/icons/Search';
import { ChevronLeft } from '../../../../common/components/icons/ChevronLeft';
import { ChevronRight } from '../../../../common/components/icons/ChevronRight';

export const GitGraphSearchToolbar: React.FC<{
    query: string;
    setQuery: (q: string) => void;
    caseSensitive: boolean;
    setCaseSensitive: React.Dispatch<React.SetStateAction<boolean>>;
    setActiveMatchIndex: (idx: number) => void;
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
    navigateMatches: (direction: -1 | 1) => void;
    canNavigate: boolean;
    counterText: string | null;
    messageSearchError: string | null;
}> = ({
    query,
    setQuery,
    caseSensitive,
    setCaseSensitive,
    setActiveMatchIndex,
    onKeyDown,
    navigateMatches,
    canNavigate,
    counterText,
    messageSearchError,
}) => {
    return (
        <div className="flex shrink-0 items-center gap-1.5 border-b border-surface0 px-3 py-2">
            <label className="flex min-w-0 flex-1 items-center gap-2 border border-surface1 bg-crust px-2.5 py-1.5 text-subtext0 focus-within:border-brand">
                <Search className="h-3.5 w-3.5 shrink-0" />
                <input
                    type="search"
                    value={query}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setActiveMatchIndex(0);
                    }}
                    onKeyDown={onKeyDown}
                    placeholder="Search commits by message, subject, author name or email, branch name, tag refs, hash…"
                    aria-label="Search commits"
                    className="git-graph-search-input min-w-0 flex-1 bg-transparent text-xs text-text outline-none placeholder:text-subtext0"
                />
                <button
                    type="button"
                    onClick={() => {
                        setCaseSensitive((value) => !value);
                        setActiveMatchIndex(0);
                    }}
                    aria-pressed={caseSensitive}
                    title={
                        caseSensitive
                            ? 'Case-sensitive search on'
                            : 'Match case'
                    }
                    className={`px-1 text-[10px] font-semibold transition-colors ${caseSensitive ? 'text-brand' : 'text-subtext0 hover:text-text'}`}
                >
                    Aa
                </button>
            </label>
            <button
                type="button"
                onClick={() => navigateMatches(-1)}
                disabled={!canNavigate}
                aria-label="Previous search result"
                title="Previous match (Shift+Enter)"
                className="flex h-7 w-6 items-center justify-center text-subtext0 hover:bg-surface0 hover:text-text disabled:opacity-35"
            >
                <ChevronLeft className="h-3 w-3" />
            </button>
            <button
                type="button"
                onClick={() => navigateMatches(1)}
                disabled={!canNavigate}
                aria-label="Next search result"
                title="Next match (Enter)"
                className="flex h-7 w-6 items-center justify-center text-subtext0 hover:bg-surface0 hover:text-text disabled:opacity-35"
            >
                <ChevronRight className="h-3 w-3" />
            </button>
            <span
                className="w-12 text-center text-[10px] tabular-nums text-subtext0"
                aria-live="polite"
                title={messageSearchError || undefined}
            >
                {counterText}
            </span>
        </div>
    );
};

