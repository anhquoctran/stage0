import React from 'react';

// Zed-inspired setting row
export interface SettingRowProps {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  borderBottom?: boolean;
}
