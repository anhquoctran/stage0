import React from 'react';
import type { SettingRowProps } from '../types/SettingRowProps';

export const SettingRow: React.FC<SettingRowProps> = ({
  title,
  description,
  children,
  borderBottom = true,
}) => {
  return (
    <div
      className={`py-3 flex items-center justify-between gap-6 ${borderBottom ? 'border-b border-surface0/40' : ''
        }`}
    >
      <div className="min-w-0 flex-1 pr-2">
        <div className="text-xs font-semibold text-text">{title}</div>
        {description && (
          <div className="text-[11px] text-subtext0 mt-0.5 leading-relaxed">
            {description}
          </div>
        )}
      </div>
      <div className="shrink-0 flex items-center">{children}</div>
    </div>
  );
};
