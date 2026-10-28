import { useMemo } from 'react';
import { DiffView, DiffModeEnum } from '@git-diff-view/react';
import { useThemeStore } from '../../../core/store/useThemeStore';
import type { ChangedFile } from '../types/ChangedFile';
import { extractFileHunks, inferLanguage } from '../utils/diffParser';

export function CommitFileDiff({ file, rawDiff }: { file: ChangedFile; rawDiff: string }) {
  const theme = useThemeStore(state => state.theme);
  const hunks = useMemo(() => extractFileHunks(rawDiff, file.path, file.old_path), [rawDiff, file.path, file.old_path]);
  const data = useMemo(() => ({
    oldFile: { fileName: file.old_path || file.path, fileLang: inferLanguage(file.old_path || file.path) },
    newFile: { fileName: file.path, fileLang: inferLanguage(file.path) }, hunks,
  }), [file.path, file.old_path, hunks]);
  return (
    <section className="min-w-0 rounded-sm bg-base" aria-label={`Changes in ${file.path}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm bg-mantle px-3 py-2">
        <span className="break-all font-mono text-xs text-text">{file.old_path ? `${file.old_path} → ${file.path}` : file.path}</span>
        <span className="text-[11px] text-subtext0">{file.status} · +{file.additions} / −{file.deletions}</span>
      </div>
      {file.is_binary ? <p className="p-4 text-xs text-subtext0">Binary file changed; no text diff is available.</p>
        : hunks.length ? <div className="overflow-x-auto"><DiffView data={data} diffViewMode={DiffModeEnum.Unified}
          diffViewTheme={theme === 'mocha' ? 'dark' : 'light'} diffViewHighlight diffViewWrap={false} diffViewFontSize={13} /></div>
          : <p className="p-4 text-xs text-subtext0">No text changes to display. This may be a rename, permission change, or a diff beyond the preview limit.</p>}
    </section>
  );
}
