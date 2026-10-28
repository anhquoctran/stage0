import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from '../../../common/components/icons/ChevronLeft';

export const PreferencesBackButton: React.FC<{
  label?: string;
  onClick: () => void;
}> = ({ label, onClick }) => {
  const { t } = useTranslation();
  const backLabel = label ?? t('common.backToAiOverview');
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-xs text-subtext0 hover:text-text transition-colors cursor-pointer group rounded-sm"
    >
      <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5 rtl:rotate-180 transition-transform" />
      <span>{backLabel}</span>
    </button>
  );
};

