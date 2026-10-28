import { useEffect, useRef, useState } from 'react';
import { X } from '../../../common/components/icons/X';
import { formatDateTime } from '../../../common/utils/dateTime';
import { useDateTimeLanguage } from '../../i18n/hooks/useDateTimeLanguage';
import { useCommitDetails } from '../hooks/useCommitDetails';
import { CommitFileDiff } from './CommitFileDiff';

export function CommitDetailsModal({ repoPath, commitHash, onClose }: {
  repoPath: string; commitHash: string; onClose: () => void;
}) {
  useDateTimeLanguage();
  const { data, loading, error, retry } = useCommitDetails(repoPath, commitHash);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); }
      if (event.key !== 'Tab') return;
      const items = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]') ?? []);
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) {
        event.preventDefault(); first?.focus();
      }
    };
    document.addEventListener('keydown', keydown, true);
    return () => { document.removeEventListener('keydown', keydown, true); previous?.focus(); };
  }, []);
  const file = data?.files.find(item => item.path === selectedPath) ?? data?.files[0];
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-3 sm:p-6"
      onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-label="Commit details" tabIndex={-1}
        className="flex h-[85vh] w-full max-w-7xl flex-col overflow-hidden rounded-sm border border-surface0 bg-base text-text shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-surface0 px-4 py-3">
          <div className="min-w-0"><h2 className="text-sm font-semibold">Commit details</h2>
            <p className="mt-1 break-all font-mono text-[11px] text-subtext0 select-text">{commitHash}</p></div>
          <button type="button" onClick={onClose} aria-label="Close commit details"
            className="shrink-0 rounded-sm p-1.5 text-subtext0 hover:bg-surface0 hover:text-text focus-visible:outline-2 focus-visible:outline-brand"><X className="h-4 w-4" /></button>
        </div>
        {loading ? <p role="status" className="p-5 text-xs text-subtext0">Loading commit details…</p> : error ? (
          <div className="p-5"><p role="alert" className="whitespace-pre-wrap text-xs text-red">{error}</p>
            <button type="button" onClick={retry} className="mt-3 rounded-sm border-0 bg-surface0 px-3 py-1.5 text-xs text-text">Retry</button></div>
        ) : data && <>
          <div className="max-h-[30vh] shrink-0 overflow-auto border-b border-surface0 p-4 select-text">
            <pre className="whitespace-pre-wrap break-words font-sans text-sm text-text">{data.message || '(no commit message)'}</pre>
            <p className="mt-3 text-xs text-subtext0">{data.author_name} {data.author_email && `<${data.author_email}>`} · {formatDateTime(data.authored_date)}</p>
            <p className="mt-1 break-all font-mono text-[10px] text-subtext0">{data.parents.length ? `Parent${data.parents.length > 1 ? 's' : ''}: ${data.parents.join(', ')}` : 'Root commit'}</p>
            {data.parents.length > 1 && <p className="mt-1 text-xs text-subtext0">Merge commit · changes compared with the first parent.</p>}
            {data.truncated && <p role="status" className="mt-2 text-xs text-yellow">The diff exceeds the 5 MiB preview limit. Only complete file diffs within the limit are shown.</p>}
          </div>
          <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
            <nav aria-label="Commit files" className="max-h-40 shrink-0 overflow-auto border-b border-surface0 bg-mantle p-2 sm:max-h-none sm:w-64 sm:border-b-0 sm:border-e">
              <p className="px-2 py-1 text-[11px] font-semibold text-subtext0">Files changed ({data.files.length})</p>
              {data.files.map(item => <button key={item.path} type="button" onClick={() => setSelectedPath(item.path)} aria-pressed={file?.path === item.path}
                className={`my-0.5 flex w-full items-start gap-2 rounded-sm border-0 px-2 py-2 text-start text-xs focus-visible:outline-2 focus-visible:outline-brand ${file?.path === item.path ? 'bg-surface0 text-text' : 'text-subtext0 hover:bg-surface0 hover:text-text'}`}>
                <span className="min-w-0 flex-1 break-all font-mono">{item.path}</span>
                <span className="shrink-0 text-[10px]">+{item.additions} / −{item.deletions}</span>
              </button>)}
            </nav>
            <div className="min-h-0 min-w-0 flex-1 overflow-auto p-3">
              {file ? <CommitFileDiff key={`${data.hash}:${file.path}`} file={file} rawDiff={data.raw_diff} />
                : <p className="p-3 text-xs text-subtext0">This commit has no file changes.</p>}
            </div>
          </div>
        </>}
      </div>
    </div>
  );
}
