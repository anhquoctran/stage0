import React from 'react';
import { useTranslation } from 'react-i18next';

export const PreferencesAiDisclaimer: React.FC<{
  isVisible: boolean;
}> = ({ isVisible }) => {
  const { t } = useTranslation();
  if (!isVisible) return null;

  return (
    <p className="mb-4 border border-surface1 bg-base p-3 text-[11px] text-subtext0">
      {t('preferences.aiDisclaimer')}
    </p>
  );
};

