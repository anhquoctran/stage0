import React,{ useEffect,useMemo,useRef,useState } from 'react';
import {
getVirtualMrSearchHighlights,
getVirtualMrSearchSuggestions,
type VirtualMrSearchSuggestion,
} from '../utils/virtualMrSearch';
import type { VirtualMrListSearchContext } from './VirtualMrListSearchContext';

export function useVirtualMrListSearch({ sessions }: VirtualMrListSearchContext) {
  const [searchTerm, setSearchTerm] = useState('');

  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const [searchCaret, setSearchCaret] = useState(0);

  const [searchScrollLeft, setSearchScrollLeft] = useState(0);

  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const searchHighlights = useMemo(() => getVirtualMrSearchHighlights(searchTerm), [searchTerm]);

  const searchSuggestions = useMemo(
    () => (isSearchFocused ? getVirtualMrSearchSuggestions(searchTerm, searchCaret, sessions) : []),
    [isSearchFocused, searchCaret, searchTerm, sessions]
  );

  useEffect(() => {
    setActiveSuggestionIndex(0);
  }, [searchSuggestions.length, searchTerm]);

  const applySearchSuggestion = (suggestion: VirtualMrSearchSuggestion) => {
    const input = searchInputRef.current;
    const caret = input?.selectionStart ?? searchTerm.length;
    const beforeCaret = searchTerm.slice(0, caret);
    const tokenStart = beforeCaret.length - (beforeCaret.match(/\S*$/)?.[0].length ?? 0);
    const afterCaret = searchTerm.slice(caret);
    const nextWhitespace = afterCaret.search(/\s/);
    const tokenEnd = nextWhitespace < 0 ? searchTerm.length : caret + nextWhitespace;
    const left = searchTerm.slice(0, tokenStart);
    const right = searchTerm.slice(tokenEnd);
    const value = suggestion.value.includes(' ')
      ? `"${suggestion.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
      : suggestion.value;
    const replacement =
      suggestion.kind === 'field' ? `${suggestion.field}:` : `${suggestion.field}:${value}`;
    const separator = suggestion.kind === 'value' && (!right || !/^\s/.test(right)) ? ' ' : '';
    const nextQuery = `${left}${replacement}${separator}${right}`;
    const nextCaret = left.length + replacement.length + separator.length;

    setSearchTerm(nextQuery);
    setSearchCaret(nextCaret);
    setIsSearchFocused(true);
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.setSelectionRange(nextCaret, nextCaret);
      setSearchCaret(nextCaret);
    });
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && searchSuggestions.length > 0) {
      event.preventDefault();
      setActiveSuggestionIndex((index) => (index + 1) % searchSuggestions.length);
    } else if (event.key === 'ArrowUp' && searchSuggestions.length > 0) {
      event.preventDefault();
      setActiveSuggestionIndex(
        (index) => (index - 1 + searchSuggestions.length) % searchSuggestions.length
      );
    } else if (event.key === 'Enter' && searchSuggestions[activeSuggestionIndex]) {
      event.preventDefault();
      applySearchSuggestion(searchSuggestions[activeSuggestionIndex]);
    } else if (event.key === 'Escape' && isSearchFocused && searchSuggestions.length > 0) {
      event.preventDefault();
      event.stopPropagation();
      setIsSearchFocused(false);
    }
  };

  return {
    searchTerm,
    searchScrollLeft,
    searchHighlights,
    searchInputRef,
    setSearchTerm,
    setSearchCaret,
    setSearchScrollLeft,
    setIsSearchFocused,
    handleSearchKeyDown,
    searchSuggestions,
    activeSuggestionIndex,
    applySearchSuggestion,
  };
}
