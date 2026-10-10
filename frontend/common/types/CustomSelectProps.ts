import type { CustomSelectOption } from './CustomSelectOption';

export interface CustomSelectProps<T extends string> {
  id?: string;
  value: T;
  options: CustomSelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  dropdownWidth?: string;
  placeholder?: string;
  align?: 'left' | 'right';
  'aria-label'?: string;
}
