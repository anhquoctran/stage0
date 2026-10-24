export interface PreferencesUiFontTabProps {
  value: string;
  onChange: (value: string) => void;
  dropdownPlacement?: 'top' | 'bottom';
  dropdownListMaxHeight?: string;
}
