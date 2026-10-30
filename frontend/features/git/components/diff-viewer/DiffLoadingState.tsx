import React from 'react';
import { useTranslation } from 'react-i18next';

export const DiffLoadingState: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-base text-subtext1">
      <div className="w-8 h-8 rounded-full border-2 border-blue border-t-transparent animate-spin mb-3" />
      <span className="text-sm font-medium text-text">{t('git.diff.loading.title')}</span>
      <span className="text-xs text-subtext0 mt-1">{t('git.diff.loading.description')}</span>
    </div>
  );
};

