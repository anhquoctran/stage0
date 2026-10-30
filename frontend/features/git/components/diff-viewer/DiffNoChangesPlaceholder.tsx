import React from 'react';
import { CheckCircle2 } from '../../../../common/components/icons/CheckCircle2';
import { useTranslation } from 'react-i18next';

export const DiffNoChangesPlaceholder: React.FC<{
  status: string;
}> = ({ status }) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center h-64 text-subtext1 text-xs space-y-1">
      <CheckCircle2 className="w-8 h-8 text-green mb-2" />
      <p className="font-semibold text-text">{t('git.diff.noChanges.title')}</p>
      <span className="text-[11px] text-subtext0">
        {t('git.diff.noChanges.status', { status })}
      </span>
    </div>
  );
};

