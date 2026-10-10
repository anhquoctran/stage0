import type { PreferenceTab } from './PreferenceTab';

export interface TreeChildItem {
  id: PreferenceTab;
  label: string;
  title: string;
  description: string;
  keywords: string[];
}
