import React from 'react';
import { useTranslation } from 'react-i18next';

export const TabBarStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const { t } = useTranslation();
  switch (status) {
    case 'resolved':
      return (
        <span className="shrink-0 whitespace-nowrap rounded-sm text-[10px] px-1.5 py-[0.2rem] bg-emerald-500/20 text-emerald-400 font-mono select-none">
          {t('common.tabs.resolved')}
        </span>
      );
    case 'closed':
      return (
        <span className="shrink-0 whitespace-nowrap rounded-sm text-[10px] px-1.5 py-[0.2rem] bg-surface2 text-subtext0 font-mono select-none">
          {t('common.tabs.closed')}
        </span>
      );
    default:
      return (
        <span className="shrink-0 whitespace-nowrap rounded-sm text-[10px] px-1.5 py-[0.2rem] bg-brand/20 text-brand font-mono font-medium select-none">
          {t('common.tabs.open')}
        </span>
      );
  }
};

