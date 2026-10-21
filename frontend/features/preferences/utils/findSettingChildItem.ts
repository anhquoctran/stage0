import { SETTINGS_TREE } from '../constants/settingsTree';

export function findSettingChildItem(normalizedTabId: string | null) {
  if (!normalizedTabId) return null;
  for (const group of SETTINGS_TREE) {
    for (const child of group.children) {
      if (child.id === normalizedTabId) return child;
    }
  }
  return null;
}

