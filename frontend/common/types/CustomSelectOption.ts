import React from 'react';

export interface CustomSelectOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  badge?: string;
  icon?: React.ReactNode;
  group?: string;
  disabled?: boolean;
}
