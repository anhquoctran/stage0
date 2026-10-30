import { Check } from '../../../../common/components/icons/Check';
import { Copy } from '../../../../common/components/icons/Copy';
import { ShieldCheck } from '../../../../common/components/icons/ShieldCheck';
import type { GitBinaryDetectionCardProps } from './GitBinaryDetectionCardProps';
import { useTranslation } from 'react-i18next';

export function GitBinaryDetectionCard({
  committedBinary,
  getSourceBadge,
  handleCopyPath,
  copiedPath,
}: GitBinaryDetectionCardProps) {
  const { t } = useTranslation();
  return (
    <div className="p-4 bg-surface0/60 border border-surface1 space-y-2 rounded-sm">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-subtext0 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-green" />
          {t('git.binary.activeInProcess')}
        </span>
        {committedBinary && getSourceBadge(committedBinary.source)}
      </div>
      {committedBinary ? (
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-text flex items-center gap-2">
              <span>{committedBinary.name}</span>
              <span className="font-mono text-[11px] px-1.5 py-0.2 bg-surface1 text-text border border-surface2">
                {committedBinary.version || t('git.binary.versionUnknown')}
              </span>
            </div>
            <div className="font-mono text-[11px] text-subtext0 truncate mt-1">
              {committedBinary.path}
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => handleCopyPath(committedBinary.path, e)}
            className="p-1.5 hover:bg-surface1 text-subtext0 hover:text-text transition-colors cursor-pointer shrink-0 rounded-sm"
            title={t('git.binary.copyActivePath')}
          >
            {copiedPath === committedBinary.path ? (
              <Check className="w-3.5 h-3.5 text-green" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      ) : (
        <div className="text-xs text-subtext0">{t('git.binary.systemDefault')}</div>
      )}
    </div>
  );
}
