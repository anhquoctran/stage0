import { SETTINGS_TREE } from '../constants/settingsTree';

export function filterSettingsTree(searchQuery: string) {
  const q = searchQuery.trim().toLowerCase();
  if (!q) return SETTINGS_TREE;

  return SETTINGS_TREE.map((group) => {
    const groupMatches = group.label.toLowerCase().includes(q);
    const matchingChildren = group.children.filter((child) => {
      return (
        groupMatches ||
        child.label.toLowerCase().includes(q) ||
        child.title.toLowerCase().includes(q) ||
        child.description.toLowerCase().includes(q) ||
        child.keywords.some((k) => k.toLowerCase().includes(q))
      );
    });

    return {
      ...group,
      children: matchingChildren,
    };
  }).filter((group) => group.children.length > 0);
}

