import { useTranslation } from 'react-i18next';
import { FileCode } from '../../../../common/components/icons/FileCode';
import { GitCommit } from '../../../../common/components/icons/GitCommit';
import type { NewVirtualMrPreviewToolbarProps } from './NewVirtualMrPreviewToolbarProps';

export function NewVirtualMrPreviewToolbar({
  setPreviewTab,
  previewTab,
  draftMr,
  diffPayload,
}: NewVirtualMrPreviewToolbarProps) {
  const { t } = useTranslation();
  return (
    <div className="h-9 border-b border-surface0 bg-crust px-4 flex items-center justify-between shrink-0 rounded-sm">
      <div className="flex items-center gap-1 h-full">
        <button
          type="button"
          onClick={() => setPreviewTab('commits')}
          className={`flex items-center gap-2 px-3 h-full text-xs font-medium transition-colors cursor-pointer border-b-2 rounded-sm ${
            previewTab === 'commits'
              ? 'border-brand text-text bg-mantle'
              : 'border-transparent text-subtext0 hover:text-text hover:bg-surface0/40'
          }`}
        >
          <GitCommit className="w-3.5 h-3.5 text-brand" />
          <span>{t('virtualMr.previewToolbar.commits')}</span>
          <span className="px-1.5 py-0.2 text-[10px] font-mono bg-surface0 border border-surface1/60 text-subtext0">
            {draftMr.commits.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setPreviewTab('diff')}
          className={`flex items-center gap-2 px-3 h-full text-xs font-medium transition-colors cursor-pointer border-b-2 rounded-sm ${
            previewTab === 'diff'
              ? 'border-brand text-text bg-mantle'
              : 'border-transparent text-subtext0 hover:text-text hover:bg-surface0/40'
          }`}
        >
          <FileCode className="w-3.5 h-3.5 text-subtext0" />
          <span>{t('virtualMr.previewToolbar.filesChanged')}</span>
          <span className="px-1.5 py-0.2 text-[10px] font-mono bg-surface0 border border-surface1/60 text-subtext0">
            {diffPayload?.files.length || 0}
          </span>
        </button>
      </div>

      {/* Diff stats overview */}
      {diffPayload && (
        <div className="flex items-center gap-2 text-[11px] font-mono text-subtext0">
          <span className="text-emerald-400 font-semibold">
            +{(diffPayload.files || []).reduce((acc, f) => acc + (f.additions || 0), 0)}
          </span>
          <span className="text-red font-semibold">
            -{(diffPayload.files || []).reduce((acc, f) => acc + (f.deletions || 0), 0)}
          </span>
        </div>
      )}
    </div>
  );
}
