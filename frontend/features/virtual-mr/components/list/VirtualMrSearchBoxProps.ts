import React from 'react';
import type { CustomSelectOption } from '../../../../common/types/CustomSelectOption';
import type { MrSort } from '../../types/MrSort';
import type { SortDirection } from '../../types/SortDirection';
import type { VirtualMrSearchHighlight } from '../../types/VirtualMrSearchHighlight';
import { type VirtualMrSearchSuggestion } from '../../utils/virtualMrSearch';

export interface VirtualMrSearchBoxProps {
  searchScrollLeft: number;
  searchHighlights: VirtualMrSearchHighlight[];
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  setSearchCaret: React.Dispatch<React.SetStateAction<number>>;
  setSearchScrollLeft: React.Dispatch<React.SetStateAction<number>>;
  setIsSearchFocused: React.Dispatch<React.SetStateAction<boolean>>;
  handleSearchKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  inline: boolean;
  searchSuggestions: VirtualMrSearchSuggestion[];
  activeSuggestionIndex: number;
  applySearchSuggestion: (suggestion: VirtualMrSearchSuggestion) => void;
  sortBy: MrSort;
  setSortBy: React.Dispatch<React.SetStateAction<MrSort>>;
  setSortDirection: React.Dispatch<React.SetStateAction<SortDirection>>;
  SORT_OPTIONS: CustomSelectOption<MrSort>[];
  sortDirection: SortDirection;
}
