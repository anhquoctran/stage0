import type { TreeChildItem } from './TreeChildItem';

export interface TreeCategory {
  id: string;
  label: string;
  children: TreeChildItem[];
}
