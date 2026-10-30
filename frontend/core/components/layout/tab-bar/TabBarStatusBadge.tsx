import React from 'react';
import { useTranslation } from 'react-i18next';

export const TabBarStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const { t } = useTranslation();
  switch (status) {
    case 'resolved':
      return (
        <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 font-mono">
          {t('common.tabs.resolved')}
        </span>
      );
    case 'closed':
      return (
        <span className="text-[10px] px-1.5 py-0.2 bg-surface2 text-subtext0 font-mono">
          {t('common.tabs.closed')}
        </span>
      );
    default:
      return (
        <span className="text-[10px] px-1.5 py-0.2 bg-brand/20 text-brand font-mono font-medium">
          {t('common.tabs.open')}
        </span>
      );
  }
};

