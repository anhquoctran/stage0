import type { SearchField } from './SearchField';

export interface VirtualMrSearchSuggestion {
  kind: 'field' | 'value';
  field: SearchField;
  value: string;
  label: string;
  detail?: string;
}

