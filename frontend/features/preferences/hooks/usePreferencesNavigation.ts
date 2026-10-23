import { useEffect, useMemo, useState } from 'react';
import { SETTINGS_TREE } from '../constants/settingsTree';
import type { PreferenceTab } from '../types/PreferenceTab';
import { filterSettingsTree } from '../utils/filterSettingsTree';
import { findSettingChildItem } from '../utils/findSettingChildItem';
import { normalizeTab } from '../utils/normalizePreferenceTab';
import type { PreferencesNavigationContext } from './PreferencesNavigationContext';

export function usePreferencesNavigation({
  isPreferencesOpen,
  initialPreferencesTab,
  setInitialPreferencesTab,
}: PreferencesNavigationContext) {
  const [activeTab, setActiveTab] = useState<PreferenceTab | null>(null);

  const [searchQuery, setSearchQuery] = useState('');

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  useEffect(() => {
    if (isPreferencesOpen && initialPreferencesTab) {
      const target = normalizeTab(initialPreferencesTab);
      setActiveTab(target);
      const openGroups: Record<string, boolean> = {};
      for (const group of SETTINGS_TREE) {
        if (group.children.some((c) => c.id === target)) {
          openGroups[group.id] = true;
          break;
        }
      }
      setExpandedGroups((prev) => ({ ...prev, ...openGroups }));
      setInitialPreferencesTab(null);
    }
  }, [isPreferencesOpen, initialPreferencesTab, setInitialPreferencesTab]);

  const filteredTree = useMemo(() => filterSettingsTree(searchQuery), [searchQuery]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const allOpen: Record<string, boolean> = {};
      filteredTree.forEach((g) => {
        allOpen[g.id] = true;
      });
      setExpandedGroups(allOpen);
    }
  }, [searchQuery, filteredTree]);

  const currentChildItem = useMemo(() => {
    return findSettingChildItem(activeTab ? normalizeTab(activeTab) : null);
  }, [activeTab]);

  return {
    setSearchQuery,
    setActiveTab,
    setExpandedGroups,
    activeTab,
    searchQuery,
    expandedGroups,
    toggleGroup,
    filteredTree,
    currentChildItem,
  };
}
