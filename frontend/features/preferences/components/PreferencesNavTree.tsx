import React from 'react';
import { Search } from '../../../common/components/icons/Search';
import { X } from '../../../common/components/icons/X';
import { ChevronRight } from '../../../common/components/icons/ChevronRight';
import type { TreeCategory } from '../types/TreeCategory';
import type { PreferenceTab } from '../types/PreferenceTab';
import { useTranslation } from 'react-i18next';

export const PreferencesNavTree: React.FC<{
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredTree: TreeCategory[];
  expandedGroups: Record<string, boolean>;
  toggleGroup: (groupId: string) => void;
  currentTabId: PreferenceTab | null;
  setActiveTab: (tab: PreferenceTab) => void;
}> = ({
  searchQuery,
  setSearchQuery,
  filteredTree,
  expandedGroups,
  toggleGroup,
  currentTabId,
  setActiveTab,
}) => {
  const { t } = useTranslation();
  return (
    <div className="w-60 border-e border-surface0/60 flex flex-col bg-mantle/50 shrink-0">
      {/* Search Input Box */}
      <div className="p-3 border-b border-surface0/60 rounded-sm">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-subtext0 absolute start-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder={t('preferences.navSearch.placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface0/50 border border-surface1/60 rounded px-2.5 ps-8 pe-7 py-1 text-xs text-text placeholder:text-subtext0 focus:outline-hidden focus:border-brand transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute end-2 text-subtext0 hover:text-text cursor-pointer p-0.5 rounded-sm"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Tree Items List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredTree.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-subtext0 italic">
            {t('preferences.navSearch.noMatches', { query: searchQuery })}
          </div>
        ) : (
          filteredTree.map((group) => {
            const isExpanded = expandedGroups[group.id] ?? false;
            const hasActiveChild = Boolean(currentTabId && group.children.some((c) => c.id === currentTabId));

            return (
              <div key={group.id} className="space-y-0.5">
                {/* Category Parent Header */}
                <button
                  type="button"
                  onClick={() => {
                    toggleGroup(group.id);
                    if (group.children.length === 1) {
                      setActiveTab(group.children[0].id);
                    }
                  }}
                  className={`w-full flex items-center justify-between px-2 py-1.5 text-xs transition-colors cursor-pointer select-none text-start group rounded-sm ${
                    hasActiveChild ? 'text-text font-medium' : 'text-subtext1 hover:text-text hover:bg-surface0/30'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ChevronRight
                      className={`w-3 h-3 text-subtext0 shrink-0 transition-transform duration-150 ${
                        isExpanded ? 'rotate-90 text-text' : 'rtl:rotate-180 group-hover:text-text'
                      }`}
                    />
                    <span className="truncate">{t(`preferences.nav.${group.id}`, group.label)}</span>
                  </div>
                </button>

                {/* Collapsible Children */}
                {isExpanded && (
                  <div className="space-y-0.5 ps-3">
                    {group.children.map((child) => {
                      const isActive = currentTabId === child.id;
                      return (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => setActiveTab(child.id)}
                          className={`w-full flex items-center justify-between ps-5 pe-2 py-1.5 text-xs transition-colors cursor-pointer text-start rounded-sm ${
                            isActive
                              ? 'bg-surface0/90 text-text font-medium shadow-xs'
                              : 'text-subtext0 hover:text-text hover:bg-surface0/50'
                          }`}
                        >
                          <span className="truncate">{t(`preferences.nav.${child.id}`, child.label)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
