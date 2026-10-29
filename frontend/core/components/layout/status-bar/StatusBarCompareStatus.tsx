import React from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck } from '../../../../common/components/icons/ShieldCheck';
import { AlertTriangle } from '../../../../common/components/icons/AlertTriangle';
import { Loader2 } from '../../../../common/components/icons/Loader2';
import { Info } from '../../../../common/components/icons/Info';
import { useGitStore } from '../../../../features/git/store/useGitStore';

export const StatusBarCompareStatus: React.FC<{
  isVisible: boolean;
}> = ({ isVisible }) => {
  const { t } = useTranslation();
  const {
    diffPayload,
    diffError,
    conflictCheckError,
    conflictReport,
    isDiffLoading,
  } = useGitStore();

  if (!isVisible) return null;

  if (diffError) {
    return (
      <div
        className="h-5.5 px-2 bg-red/10 border border-red/25 text-red flex items-center gap-1.5 font-medium shadow-xs rounded-sm"
        title={diffError}
      >
        <AlertTriangle className="w-3 h-3 text-red shrink-0" />
        <span className="max-lg:hidden">{t('compareStatus.failed')}</span>
      </div>
    );
  }

  if (isDiffLoading) {
    return (
      <div
        className="h-5.5 px-2 bg-surface0/60 border border-surface1/60 text-subtext0 flex items-center gap-1.5 font-medium shadow-xs rounded-sm"
        title={t('compareStatus.comparingTitle')}
      >
        <Loader2 className="w-3 h-3 animate-spin text-blue shrink-0" />
        <span className="max-lg:hidden">{t('compareStatus.comparing')}</span>
      </div>
    );
  }

  if (conflictCheckError) {
    return (
      <div
        className="h-5.5 px-2 bg-amber-500/10 border border-amber-500/25 text-amber-400 flex items-center gap-1.5 font-medium shadow-xs rounded-sm"
        title={conflictCheckError}
      >
        <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
        <span className="max-lg:hidden">{t('compareStatus.unavailable')}</span>
      </div>
    );
  }

  if (diffPayload && diffPayload.files.length === 0) {
    return (
      <div
        className="h-5.5 px-2 bg-surface0/50 border border-surface1/50 text-subtext1 flex items-center gap-1.5 font-medium shadow-xs rounded-sm"
        title={t('compareStatus.noChanges')}
      >
        <Info className="w-3 h-3 text-subtext0 shrink-0" />
        <span className="max-lg:hidden">{t('compareStatus.noChanges')}</span>
      </div>
    );
  }

  if (conflictReport?.has_conflicts) {
    return (
      <div
        className="h-5.5 px-2 bg-red/10 border border-red/25 text-red flex items-center gap-1.5 font-medium shadow-xs rounded-sm"
        title={t('compareStatus.conflicts')}
      >
        <AlertTriangle className="w-3 h-3 text-red shrink-0" />
        <span className="max-lg:hidden">{t('compareStatus.conflicts')}</span>
      </div>
    );
  }

  if (conflictReport) {
    return (
      <div
        className="h-5.5 px-2 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 flex items-center gap-1.5 font-medium shadow-xs rounded-sm"
        title={t('compareStatus.clean')}
      >
        <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
        <span className="max-lg:hidden">{t('compareStatus.clean')}</span>
      </div>
    );
  }

  return null;
};

