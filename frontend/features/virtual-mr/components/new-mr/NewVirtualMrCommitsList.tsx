import { useTranslation as useUiTextTranslation } from 'react-i18next';
import { formatRecentTime } from '@/common/utils/dateTime';
import { useDateTimeLanguage } from '../../../i18n/hooks/useDateTimeLanguage';
import { AlertTriangle } from '../../../../common/components/icons/AlertTriangle';
import { GitCommit } from '../../../../common/components/icons/GitCommit';
import { Loader2 } from '../../../../common/components/icons/Loader2';
import type { NewVirtualMrCommitsListProps } from './NewVirtualMrCommitsListProps';

export function NewVirtualMrCommitsList({
  draftMr,
  changeDraftBranches,
}: NewVirtualMrCommitsListProps) {
  const { t: translateUiText } = useUiTextTranslation();
  useDateTimeLanguage();
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2">
      {draftMr.isCommitsLoading ? (
        <div className="p-8 flex items-center justify-center gap-2 text-subtext0 text-xs">
          <Loader2 className="w-4 h-4 animate-spin text-brand" />
          <span>{translateUiText('virtualMr.newMrCommits.loading')}</span>
        </div>
      ) : draftMr.commitsError ? (
        <div className="p-6 flex flex-col items-center gap-2 text-center text-xs">
          <AlertTriangle className="w-4 h-4 text-yellow" />
          <span className="text-text">{translateUiText('virtualMr.newMrCommits.loadError')}</span>
          <details className="max-w-xl text-start text-subtext0">
            <summary className="cursor-pointer hover:text-text">{translateUiText('virtualMr.newMrCommits.errorDetails')}</summary>
            <pre className="mt-2 p-3 bg-base border border-surface0 whitespace-pre-wrap break-words select-text">
              {draftMr.commitsError}
            </pre>
          </details>
          <button
            type="button"
            onClick={() => void changeDraftBranches(draftMr.baseBranch, draftMr.compareBranch)}
            className="mt-1 px-3 py-1.5 bg-surface0 hover:bg-surface1 border border-surface1 text-text transition-colors cursor-pointer rounded-sm"
          >
            {translateUiText('virtualMr.newMrCommits.retry')}
          </button>
        </div>
      ) : draftMr.commits.length === 0 ? (
        <div className="p-8 text-center text-subtext0 text-xs italic">
          {translateUiText('virtualMr.newMrCommits.empty', {
            compare: draftMr.compareBranch,
            base: draftMr.baseBranch,
          })}
        </div>
      ) : (
        draftMr.commits.map((c) => (
          <div
            key={c.hash}
            className="flex items-center justify-between p-3 border border-surface0/80 bg-base hover:border-surface1 hover:bg-surface0/30 transition-all shadow-xs rounded-sm"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1 pe-3">
              <div className="w-7 h-7 bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shrink-0">
                <GitCommit className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-text truncate">{c.subject}</div>
                <div className="flex items-center gap-2 text-[10px] text-subtext0 mt-0.5">
                  <span className="text-subtext1 font-medium">{c.authorName}</span>
                  <span>•</span>
                  <span>{formatRecentTime(c.authoredDate)}</span>
                </div>
              </div>
            </div>

            <div className="shrink-0">
              <span className="px-2 py-1 bg-surface0 text-[10px] font-mono text-brand border border-surface1">
                {c.shortHash}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
