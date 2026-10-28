import { CustomSelect } from '../../../../common/components/CustomSelect';
import { Search } from '../../../../common/components/icons/Search';
import { SortAscending } from '../../../../common/components/icons/SortAscending';
import { SortDescending } from '../../../../common/components/icons/SortDescending';
import type { MrSort } from '../../types/MrSort';
import { SearchSuggestionIcon } from '../SearchSuggestionIcon';
import type { VirtualMrSearchBoxProps } from './VirtualMrSearchBoxProps';

export function VirtualMrSearchBox({
  searchScrollLeft,
  searchHighlights,
  searchInputRef,
  searchTerm,
  setSearchTerm,
  setSearchCaret,
  setSearchScrollLeft,
  setIsSearchFocused,
  handleSearchKeyDown,
  inline,
  searchSuggestions,
  activeSuggestionIndex,
  applySearchSuggestion,
  sortBy,
  setSortBy,
  setSortDirection,
  SORT_OPTIONS,
  sortDirection,
}: VirtualMrSearchBoxProps) {
  return (
    <div className="flex h-8 min-w-[340px] flex-1 items-stretch border border-surface1 bg-crust focus-within:border-brand">
      <div className="relative min-w-0 flex-1">
        <label className="flex h-full items-center gap-2 px-2.5 text-subtext0">
          <Search className="h-3.5 w-3.5 shrink-0" />
          <div className="relative h-full min-w-0 flex-1 overflow-hidden">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex items-center overflow-hidden"
            >
              <span
                className="block w-max whitespace-pre text-xs leading-4 text-text"
                style={{ transform: `translateX(-${searchScrollLeft}px)` }}
              >
                {searchHighlights.map((segment, index) => {
                  if (!segment.isFilter) return <span key={index}>{segment.text}</span>;

                  const separator = segment.text.indexOf(':');
                  return (
                    <span key={index} className="mr-list-search-filter-badge align-baseline">
                      <span className="text-subtext0">{segment.text.slice(0, separator + 1)}</span>
                      <span className="bg-brand/15 text-brand">
                        {segment.text.slice(separator + 1)}
                      </span>
                    </span>
                  );
                })}
              </span>
            </div>
            <input
              ref={searchInputRef}
              type="search"
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setSearchCaret(event.target.selectionStart ?? event.target.value.length);
                setSearchScrollLeft(event.target.scrollLeft);
              }}
              onScroll={(event) => setSearchScrollLeft(event.currentTarget.scrollLeft)}
              onFocus={(event) => {
                setIsSearchFocused(true);
                setSearchCaret(event.currentTarget.selectionStart ?? searchTerm.length);
              }}
              onBlur={() => setIsSearchFocused(false)}
              onClick={(event) =>
                setSearchCaret(event.currentTarget.selectionStart ?? searchTerm.length)
              }
              onKeyUp={(event) =>
                setSearchCaret(event.currentTarget.selectionStart ?? searchTerm.length)
              }
              onKeyDown={handleSearchKeyDown}
              placeholder="Search MRs or type to filter…"
              className="mr-list-search-input absolute inset-0 h-full w-full min-w-0 bg-transparent text-xs leading-4 text-transparent caret-text placeholder:text-subtext0 focus:outline-none selection:bg-brand/50 selection:text-text rounded-sm"
              aria-label="Search merge requests"
              aria-autocomplete="list"
              aria-controls={`virtual-mr-${inline ? 'inline' : 'dialog'}-search-suggestions`}
              aria-expanded={searchSuggestions.length > 0}
              aria-activedescendant={
                searchSuggestions.length > 0
                  ? `virtual-mr-${inline ? 'inline' : 'dialog'}-search-suggestion-${activeSuggestionIndex}`
                  : undefined
              }
            />
          </div>
        </label>
        {searchSuggestions.length > 0 && (
          <div
            id={`virtual-mr-${inline ? 'inline' : 'dialog'}-search-suggestions`}
            className="absolute start-0 top-full z-[120] mt-1 max-h-80 w-[min(26rem,calc(100vw-2rem))] overflow-y-auto border border-surface1 bg-surface0 py-1 text-start shadow-xl rounded-sm"
            role="listbox"
            aria-label="Search suggestions"
          >
            {searchSuggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.field}:${suggestion.value}`}
                id={`virtual-mr-${inline ? 'inline' : 'dialog'}-search-suggestion-${index}`}
                type="button"
                role="option"
                aria-selected={activeSuggestionIndex === index}
                onMouseDown={(event) => {
                  event.preventDefault();
                  applySearchSuggestion(suggestion);
                }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-xs transition-colors cursor-pointer rounded-sm ${
                  activeSuggestionIndex === index
                    ? 'bg-surface2 text-text'
                    : 'text-subtext1 hover:bg-surface1 hover:text-text'
                }`}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center text-brand">
                  <SearchSuggestionIcon field={suggestion.field} />
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{suggestion.label}</span>
                <span className="shrink-0 truncate text-[10px] text-subtext0">
                  {suggestion.detail}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex h-full shrink-0 items-center border-s border-surface1">
        <CustomSelect<MrSort>
          value={sortBy}
          onChange={(nextSort) => {
            setSortBy(nextSort);
            setSortDirection(nextSort === 'title' ? 'asc' : 'desc');
          }}
          options={SORT_OPTIONS}
          className="mr-list-sort-custom-select h-full"
          buttonClassName="h-full min-w-[140px] max-w-[170px]"
          dropdownWidth="w-40"
          align="left"
          aria-label="Sort merge requests"
        />
      </div>
      <button
        type="button"
        onClick={() => setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'))}
        className="flex h-full w-8 shrink-0 items-center justify-center border-s border-surface1 bg-surface0 text-text hover:bg-surface1 focus-visible:outline focus-visible:outline-1 focus-visible:outline-brand cursor-pointer rounded-sm"
        aria-label={`Switch to ${sortDirection === 'asc' ? 'descending' : 'ascending'} order`}
        title={`${sortDirection === 'asc' ? 'Ascending' : 'Descending'} order`}
      >
        {sortDirection === 'asc' ? (
          <SortAscending className="h-3 w-3" />
        ) : (
          <SortDescending className="h-3 w-3" />
        )}
      </button>
    </div>
  );
}
