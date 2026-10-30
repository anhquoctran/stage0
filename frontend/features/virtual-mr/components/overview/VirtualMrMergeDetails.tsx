import React from 'react';
import { useTranslation } from 'react-i18next';
import type { VirtualMrSession } from '../../types/VirtualMrSession';

export const VirtualMrMergeDetails: React.FC<{ session: VirtualMrSession }> = ({ session }) => {
  const { t } = useTranslation();
  const commitCount = session.commits.length;

  return (
    <div className="p-4 rounded-sm bg-mantle border border-surface0 space-y-2 text-xs">
      <span className="font-semibold text-text">{t('virtualMr.mergeDetails.title')}</span>
      <ul className="list-disc list-inside text-subtext0 space-y-1 text-[11px]">
        <li>
          {t('virtualMr.mergeDetails.summary', { count: commitCount, base: session.baseBranch, compare: session.compareBranch })}
        </li>
        <li>
          {t('virtualMr.mergeDetails.comparisonRef')} <span className="font-mono text-text">{session.compareBranch}</span> →{' '}
          <span className="font-mono text-text">{session.baseBranch}</span>
        </li>
      </ul>
    </div>
  );
};

