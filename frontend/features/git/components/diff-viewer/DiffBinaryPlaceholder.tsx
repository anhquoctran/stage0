import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileWarning } from '../../../../common/components/icons/FileWarning';

export const DiffBinaryPlaceholder: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-64 h-full flex-col items-center justify-center px-6 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center border border-amber-400/30 bg-amber-400/10 text-amber-400">
        <FileWarning className="h-6 w-6" />
      </div>
      <h3 className="mb-1 text-sm font-semibold text-text">{t('git.diff.binary.title')}</h3>
      <p className="max-w-md text-xs leading-relaxed text-subtext1">
        {t('git.diff.binary.description')}
      </p>
      <p className="mt-2 text-[11px] text-subtext0">
        {t('git.diff.binary.externalViewerHint')}
      </p>
    </div>
  );
};

