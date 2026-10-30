import React from 'react';
import { useTranslation as useUiTextTranslation } from 'react-i18next';
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
    const { t: translateUiText } = useUiTextTranslation();
    return (
        <div className="flex shrink-0 items-center gap-1.5 border-b border-surface0 px-3 py-2 rounded-sm">
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
                    placeholder={translateUiText('git.graphSearch.placeholder')}
                    aria-label={translateUiText('git.graphSearch.searchLabel')}
                    className="git-graph-search-input min-w-0 flex-1 bg-transparent text-xs text-text outline-none placeholder:text-subtext0 rounded-sm"
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
                            ? translateUiText('git.graphSearch.caseSensitiveOn')
                            : translateUiText('git.graphSearch.matchCase')
                    }
                    className={`px-1 text-[10px] font-semibold transition-colors rounded-sm ${caseSensitive ? 'text-brand' : 'text-subtext0 hover:text-text'}`}
                >
                    Aa
                </button>
            </label>
            <button
                type="button"
                onClick={() => navigateMatches(-1)}
                disabled={!canNavigate}
                aria-label={translateUiText('git.graphSearch.previousResult')}
                title={translateUiText('git.graphSearch.previousMatch')}
                className="flex h-7 w-6 items-center justify-center text-subtext0 hover:bg-surface0 hover:text-text disabled:opacity-35 rounded-sm"
            >
                <ChevronLeft className="h-3 w-3" />
            </button>
            <button
                type="button"
                onClick={() => navigateMatches(1)}
                disabled={!canNavigate}
                aria-label={translateUiText('git.graphSearch.nextResult')}
                title={translateUiText('git.graphSearch.nextMatch')}
                className="flex h-7 w-6 items-center justify-center text-subtext0 hover:bg-surface0 hover:text-text disabled:opacity-35 rounded-sm"
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

