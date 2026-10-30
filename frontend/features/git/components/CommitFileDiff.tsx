import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DiffView, DiffModeEnum } from '@git-diff-view/react';
import { useThemeStore } from '../../../core/store/useThemeStore';
import type { ChangedFile } from '../types/ChangedFile';
import { extractFileHunks, inferLanguage } from '../utils/diffParser';

export function CommitFileDiff({ file, rawDiff }: { file: ChangedFile; rawDiff: string }) {
  const { t } = useTranslation();
  const theme = useThemeStore(state => state.theme);
  const hunks = useMemo(() => extractFileHunks(rawDiff, file.path, file.old_path), [rawDiff, file.path, file.old_path]);
  const data = useMemo(() => ({
    oldFile: { fileName: file.old_path || file.path, fileLang: inferLanguage(file.old_path || file.path) },
    newFile: { fileName: file.path, fileLang: inferLanguage(file.path) }, hunks,
  }), [file.path, file.old_path, hunks]);
  return (
    <section className="min-w-0 rounded-sm bg-base" aria-label={t('git.commitDetails.changesIn', { path: file.path })}>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm bg-mantle px-3 py-2">
        <span dir="ltr" className="break-all font-mono text-xs text-text">{file.old_path ? `${file.old_path} → ${file.path}` : file.path}</span>
        <span className="text-[11px] text-subtext0">{file.status} · +{file.additions} / −{file.deletions}</span>
      </div>
      {file.is_binary ? <p className="p-4 text-xs text-subtext0">{t('git.commitDetails.binaryFile')}</p>
        : hunks.length ? <div className="overflow-x-auto"><DiffView data={data} diffViewMode={DiffModeEnum.Unified}
          diffViewTheme={theme === 'mocha' ? 'dark' : 'light'} diffViewHighlight diffViewWrap={false} diffViewFontSize={13} /></div>
          : <p className="p-4 text-xs text-subtext0">{t('git.commitDetails.noTextChanges')}</p>}
    </section>
  );
}
