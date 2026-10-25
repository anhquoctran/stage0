import { useApplicationServices } from '../../../core/services/runtime/useApplicationServices';

import { useEffect, useMemo, useState } from 'react';
import type { CommitMessageSearchResult } from '../types/CommitMessageSearchResult';
import type { GitGraphSearchContext } from './GitGraphSearchContext';

export function useGitGraphSearch({ isOpen, repoPath, graph, commits }: GitGraphSearchContext) {
  const appServices = useApplicationServices();
  const [query, setQuery] = useState('');

  const [debouncedSearchText, setDebouncedSearchText] = useState('');

  const [caseSensitive, setCaseSensitive] = useState(false);

  const [messageSearchResult, setMessageSearchResult] = useState<CommitMessageSearchResult | null>(
    null
  );

  const [isSearchingCommitMessages, setIsSearchingCommitMessages] = useState(false);

  const [messageSearchError, setMessageSearchError] = useState<string | null>(null);

  const searchText = query.trim();

  const isSearchEligible = Array.from(searchText).length >= 3;

  useEffect(() => {
    if (!isSearchEligible) {
      setDebouncedSearchText('');
      return;
    }

    const timeout = window.setTimeout(() => setDebouncedSearchText(searchText), 300);
    return () => window.clearTimeout(timeout);
  }, [isSearchEligible, searchText]);

  const activeSearchText = isSearchEligible ? debouncedSearchText : '';

  const isSearchDebouncing = isSearchEligible && searchText !== debouncedSearchText;

  const hasSearchFilter = Array.from(activeSearchText).length >= 3;

  useEffect(() => {
    if (!isOpen || !repoPath || !graph || !hasSearchFilter) {
      setMessageSearchResult(null);
      setIsSearchingCommitMessages(false);
      setMessageSearchError(null);
      return;
    }

    let isCurrentRequest = true;
    setMessageSearchResult(null);
    setMessageSearchError(null);
    setIsSearchingCommitMessages(true);
    appServices.gitHistory.searchGitCommitMessages({
      repoPath,
      query: activeSearchText,
      caseSensitive,
      commitHashes: graph.commits.map((commit) => commit.hash),
    })
      .then((hashes) => {
        if (isCurrentRequest) {
          setMessageSearchResult({
            query: activeSearchText,
            caseSensitive,
            hashes: new Set(hashes),
          });
        }
      })
      .catch((reason: unknown) => {
        if (isCurrentRequest) {
          setMessageSearchError(reason instanceof Error ? reason.message : String(reason));
          setMessageSearchResult({
            query: activeSearchText,
            caseSensitive,
            hashes: new Set(),
          });
        }
      })
      .finally(() => {
        if (isCurrentRequest) setIsSearchingCommitMessages(false);
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [activeSearchText, caseSensitive, graph, hasSearchFilter, isOpen, repoPath]);

  const matchingCommitIndexes = useMemo(() => {
    const trimmedQuery = activeSearchText;
    const needle = caseSensitive ? trimmedQuery : trimmedQuery.toLowerCase();
    if (!hasSearchFilter) return [];
    const messageMatches =
      messageSearchResult?.query === trimmedQuery &&
      messageSearchResult.caseSensitive === caseSensitive
        ? messageSearchResult.hashes
        : null;

    return commits.flatMap((commit, index) => {
      const haystack = [
        commit.subject,
        commit.author_name,
        commit.author_email,
        commit.hash,
        commit.short_hash,
        ...commit.refs,
      ].join(' ');
      const searchable = caseSensitive ? haystack : haystack.toLowerCase();
      return searchable.includes(needle) || messageMatches?.has(commit.hash) ? [index] : [];
    });
  }, [activeSearchText, caseSensitive, commits, hasSearchFilter, messageSearchResult]);

  const displayedCommitIndexes = useMemo(
    () => (hasSearchFilter ? matchingCommitIndexes : commits.map((_, index) => index)),
    [commits, hasSearchFilter, matchingCommitIndexes]
  );

  return {
    displayedCommitIndexes,
    matchingCommitIndexes,
    hasSearchFilter,
    isSearchDebouncing,
    query,
    setQuery,
    caseSensitive,
    setCaseSensitive,
    isSearchingCommitMessages,
    messageSearchError,
    searchText,
    isSearchEligible,
  };
}
