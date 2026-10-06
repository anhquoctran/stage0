import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  DiffView,
  DiffModeEnum,
} from '@git-diff-view/react';
import {
  Columns2,
  Rows2,
  Copy,
  Check,
  FileCode,
  FileText,
  FileWarning,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  GitPullRequest,
  CheckCircle2,
  History,
  GitCommit,
  Code2,
  GitBranch,
  RotateCw,
  ArrowDown,
  GitMerge,
  ShieldAlert,
} from '@/common/components/icons';
import { invoke } from '@tauri-apps/api/core';
import { ChangedFile, MrDiffPayload, ViewMode, FileBlamePayload } from '../types/git';
import { extractFileHunks, inferLanguage } from '../utils/diffParser';
import { openFileInEditor } from '../utils/fileActions';
import { formatShortcutText } from '../../../common/utils/shortcuts';
import { useGitStore } from '../store/useGitStore';
import { useThemeStore } from '../../../core/store/useThemeStore';
import { usePreferencesStore } from '../../preferences/store/usePreferencesStore';
import { FileActionMenu } from './FileActionMenu';
import { BlameViewer } from './BlameViewer';
import { InlineBlame } from './InlineBlame';
import { ConflictViewer } from './ConflictViewer';
import { DiffDiscussionsBanner } from './DiffDiscussionsBanner';
import { WelcomeScreen } from '../../../core/components/layout/WelcomeScreen';

interface DiffViewerProps {
  selectedFile: ChangedFile | null;
  diffPayload: MrDiffPayload | null;
  viewMode: ViewMode;
  onToggleViewMode: (mode: ViewMode) => void;
  isLoading?: boolean;
  onOpenRepo?: () => void;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  selectedFile,
  diffPayload,
  viewMode,
  onToggleViewMode,
  isLoading = false,
  onOpenRepo,
}) => {
  const {
    selectNextFile,
    selectPrevFile,
    selectNextConflictFile,
    selectPrevConflictFile,
    baseBranch,
    compareBranch,
    fileViewTab,
    setFileViewTab,
    toggleFileBlame,
    blamePayload,
    fetchFileBlame,
    remoteUrl,
    showToast,
    currentRepo,
    conflictReport,
    diffError,
    activeConflictPreview,
    refreshDiff,
  } = useGitStore();
  const { theme } = useThemeStore();
  const {
    fontFamily,
    fontSize,
    lineSpacing,
    enableLigatures,
    isBold,
    isItalic,
    isUnderline,
    showInlineBlame,
    toggleInlineBlame,
  } = usePreferencesStore();
  const [copied, setCopied] = useState(false);

  // Active line state for VSCode-style inline git blame
  const [activeLine, setActiveLine] = useState<{
    side: 'old' | 'new';
    lineNo: number;
  } | null>(null);
  const [oldBlamePayload, setOldBlamePayload] = useState<FileBlamePayload | null>(null);
  const [portalMount, setPortalMount] = useState<HTMLElement | null>(null);
  const diffContainerRef = useRef<HTMLDivElement>(null);

  // Global Alt+B shortcut to toggle blame
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleFileBlame();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleFileBlame]);

  // Prefetch git blame for current file in background (for compare revision & base revision)
  useEffect(() => {
    if (selectedFile && currentRepo && !selectedFile.is_binary) {
      fetchFileBlame(selectedFile.path, compareBranch || 'HEAD');
      if (baseBranch) {
        const oldPath = selectedFile.old_path || selectedFile.path;
        invoke<FileBlamePayload>('get_file_blame', {
          repoPath: currentRepo.local_path,
          filePath: oldPath,
          revision: baseBranch,
          ignoreWhitespace: false,
        })
          .then((payload) => setOldBlamePayload(payload))
          .catch(() => setOldBlamePayload(null));
      }
    } else if (selectedFile?.is_binary) {
      setOldBlamePayload(null);
    }
  }, [
    selectedFile?.path,
    selectedFile?.old_path,
    selectedFile?.is_binary,
    compareBranch,
    baseBranch,
    currentRepo?.local_path,
    fetchFileBlame,
  ]);

  // Set default active line on file change
  useEffect(() => {
    if (selectedFile) {
      setActiveLine({ side: 'new', lineNo: 1 });
    }
  }, [selectedFile?.path]);

  const hunks = useMemo(() => {
    if (!diffPayload || !selectedFile) return [];
    return extractFileHunks(
      diffPayload.raw_diff,
      selectedFile.path,
      selectedFile.old_path
    );
  }, [diffPayload, selectedFile]);

  const fileLang = useMemo(() => {
    if (!selectedFile) return 'text';
    return inferLanguage(selectedFile.path);
  }, [selectedFile]);

  const diffData = useMemo(() => {
    if (!selectedFile) return null;
    return {
      oldFile: {
        fileName: selectedFile.old_path || selectedFile.path,
        fileLang,
      },
      newFile: {
        fileName: selectedFile.path,
        fileLang,
      },
      hunks,
    };
  }, [selectedFile, fileLang, hunks]);

  // Handle clicking any line in the diff viewer to move active inline blame line
  const handleDiffClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.inline-blame-badge')) return;

    const tr = target.closest('tr.diff-line') as HTMLTableRowElement | null;
    if (!tr) return;

    const oldNumTd = tr.querySelector('.diff-line-old-num') as HTMLElement | null;
    const newNumTd = tr.querySelector('.diff-line-new-num') as HTMLElement | null;
    const oldContentTd = tr.querySelector('.diff-line-old-content') as HTMLElement | null;
    const newContentTd = tr.querySelector('.diff-line-new-content') as HTMLElement | null;

    const unifiedNumTd = tr.querySelector('.diff-line-num') as HTMLElement | null;
    const unifiedContentTd = tr.querySelector('.diff-line-content') as HTMLElement | null;

    let side: 'old' | 'new' = 'new';
    let lineNo: number | null = null;

    if (oldContentTd && newContentTd) {
      // Split mode
      const isOldSide = Boolean(target.closest('.diff-line-old-content, .diff-line-old-num'));
      if (isOldSide) {
        side = 'old';
        const numSpan = oldNumTd?.querySelector('[data-line-num]');
        const raw = numSpan?.getAttribute('data-line-num');
        lineNo = raw ? parseInt(raw, 10) : null;
      } else {
        side = 'new';
        const numSpan = newNumTd?.querySelector('[data-line-num]');
        const raw = numSpan?.getAttribute('data-line-num');
        lineNo = raw ? parseInt(raw, 10) : null;
      }
    } else if (unifiedContentTd && unifiedNumTd) {
      // Unified mode
      const newSpan = unifiedNumTd.querySelector('[data-line-new-num]');
      const oldSpan = unifiedNumTd.querySelector('[data-line-old-num]');
      const newRaw = newSpan?.getAttribute('data-line-new-num');
      const oldRaw = oldSpan?.getAttribute('data-line-old-num');

      if (newRaw && parseInt(newRaw, 10)) {
        side = 'new';
        lineNo = parseInt(newRaw, 10);
      } else if (oldRaw && parseInt(oldRaw, 10)) {
        side = 'old';
        lineNo = parseInt(oldRaw, 10);
      }
    }

    if (lineNo && !isNaN(lineNo)) {
      setActiveLine({ side, lineNo });
    }
  }, []);

  // Compute active commit from blame payload
  const activeBlameCommit = useMemo(() => {
    if (!activeLine) return null;
    const payload =
      activeLine.side === 'old' && oldBlamePayload ? oldBlamePayload : blamePayload;
    if (!payload) return null;
    const line = payload.lines.find((l) => l.line_no === activeLine.lineNo);
    if (!line) return null;
    return payload.commits[line.commit_id] || null;
  }, [activeLine, blamePayload, oldBlamePayload]);

  // Mount inline blame DOM wrapper and set active line highlight
  useEffect(() => {
    if (!showInlineBlame) {
      if (diffContainerRef.current) {
        diffContainerRef.current
          .querySelectorAll('.stage0-active-line')
          .forEach((el) => el.classList.remove('stage0-active-line'));
        diffContainerRef.current
          .querySelectorAll('.stage0-inline-blame-wrapper')
          .forEach((el) => el.remove());
      }
      setPortalMount(null);
      return;
    }

    if (!activeLine || !diffContainerRef.current) return;
    const container = diffContainerRef.current;

    let targetTd: HTMLElement | null = null;

    // Split view check
    if (activeLine.side === 'new') {
      const span = container.querySelector(
        `.diff-line-new-num [data-line-num="${activeLine.lineNo}"]`
      );
      if (span) {
        targetTd = span.closest('tr')?.querySelector('.diff-line-new-content') as HTMLElement | null;
      }
    } else {
      const span = container.querySelector(
        `.diff-line-old-num [data-line-num="${activeLine.lineNo}"]`
      );
      if (span) {
        targetTd = span.closest('tr')?.querySelector('.diff-line-old-content') as HTMLElement | null;
      }
    }

    // Unified view check
    if (!targetTd) {
      if (activeLine.side === 'new') {
        const span = container.querySelector(
          `[data-line-new-num="${activeLine.lineNo}"]`
        );
        if (span) {
          targetTd = span.closest('tr')?.querySelector('.diff-line-content') as HTMLElement | null;
        }
      } else {
        const span = container.querySelector(
          `[data-line-old-num="${activeLine.lineNo}"]`
        );
        if (span) {
          targetTd = span.closest('tr')?.querySelector('.diff-line-content') as HTMLElement | null;
        }
      }
    }

    if (!targetTd) {
      setPortalMount(null);
      return;
    }

    // Update active line highlight
    container
      .querySelectorAll('.stage0-active-line')
      .forEach((el) => el.classList.remove('stage0-active-line'));
    targetTd.closest('tr')?.classList.add('stage0-active-line');

    // Remove old mount points from other lines
    container.querySelectorAll('.stage0-inline-blame-wrapper').forEach((el) => {
      if (el.parentElement !== targetTd) {
        el.remove();
      }
    });

    // Create or locate mount point in targetTd
    let mount = targetTd.querySelector('.stage0-inline-blame-wrapper') as HTMLElement | null;
    if (!mount) {
      mount = document.createElement('span');
      mount.className = 'stage0-inline-blame-wrapper';
      targetTd.appendChild(mount);
    }

    setPortalMount(mount);
  }, [
    activeLine,
    showInlineBlame,
    diffData,
    viewMode,
    fileViewTab,
    fontSize,
    fontFamily,
    theme,
  ]);

  // Clean up portal mount and active line highlight on unmount or file change
  useEffect(() => {
    return () => {
      if (diffContainerRef.current) {
        diffContainerRef.current
          .querySelectorAll('.stage0-active-line')
          .forEach((el) => el.classList.remove('stage0-active-line'));
        diffContainerRef.current
          .querySelectorAll('.stage0-inline-blame-wrapper')
          .forEach((el) => el.remove());
      }
    };
  }, [selectedFile?.path]);

  const handleCopyPath = () => {
    if (!selectedFile) return;
    navigator.clipboard.writeText(selectedFile.path);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentFileIndex = useMemo(() => {
    if (!diffPayload || !selectedFile) return -1;
    return diffPayload.files.findIndex((f) => f.path === selectedFile.path);
  }, [diffPayload, selectedFile]);

  const conflictedFiles = useMemo(
    () => diffPayload?.files.filter((f) => f.is_conflicted && !f.is_binary) || [],
    [diffPayload]
  );

  const currentConflictIndex = useMemo(
    () => conflictedFiles.findIndex((f) => f.path === selectedFile?.path),
    [conflictedFiles, selectedFile]
  );

  const scrollToFirstConflict = () => {
    if (!diffContainerRef.current) return;
    const items = diffContainerRef.current.querySelectorAll(
      '.diff-line-content, .diff-line-content-item, .diff-line-old, .diff-line-new'
    );
    for (const el of items) {
      if (
        el.textContent?.includes('<<<<<<<') ||
        el.textContent?.includes('=======') ||
        el.textContent?.includes('>>>>>>>')
      ) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('bg-red/30');
        setTimeout(() => el.classList.remove('bg-red/30'), 2500);
        showToast('Jumped to conflict marker');
        return;
      }
    }
    const firstHunk = diffContainerRef.current.querySelector('.diff-line-old, .diff-line-new');
    if (firstHunk) {
      firstHunk.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showToast('Jumped to first diff modification');
    }
  };

  const hasPrev = currentFileIndex > 0;
  const hasNext = diffPayload && currentFileIndex !== -1 && currentFileIndex < diffPayload.files.length - 1;

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-base text-subtext1">
        <div className="w-8 h-8 border-2 border-blue border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-sm font-medium text-text">Computing 3-dot MR diff...</span>
        <span className="text-xs text-subtext0 mt-1">Executing git diff and merge-tree simulation</span>
      </div>
    );
  }

  // Welcome Screen when no repository is open
  if (!currentRepo) {
    return <WelcomeScreen onOpenRepo={onOpenRepo} />;
  }

  if (diffError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-base p-8 text-center select-none">
        <div className="w-12 h-12 bg-red/10 border border-red/30 flex items-center justify-center text-red mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-text mb-1">Couldn't compare these branches</h3>
        <p className="text-xs text-subtext1 max-w-lg leading-relaxed mb-4">
          Check that both branches still exist and that the repository is available, then retry the comparison.
        </p>
        <details className="max-w-xl w-full text-left text-xs text-subtext0 mb-4">
          <summary className="cursor-pointer hover:text-text">Git error details</summary>
          <pre className="mt-2 p-3 bg-crust border border-surface0 whitespace-pre-wrap break-words select-text">{diffError}</pre>
        </details>
        <button
          type="button"
          onClick={() => void refreshDiff()}
          className="flex items-center gap-2 px-3 py-1.5 bg-surface0 hover:bg-surface1 border border-surface1 text-text text-xs transition-colors cursor-pointer"
        >
          <RotateCw className="w-3.5 h-3.5" />
          Retry comparison
        </button>
      </div>
    );
  }

  // Fallback when repository is loaded but diff is not yet computed
  if (!diffPayload) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-base p-8 text-center select-none">
        <div className="w-16 h-16 rounded-xl bg-mantle border border-surface0 flex items-center justify-center text-blue mb-4 shadow-md">
          <GitPullRequest className="w-8 h-8" />
        </div>
        <h3 className="text-[1rem] font-bold text-text mb-1">
          {currentRepo.name}
        </h3>
        <p className="text-xs text-subtext1 max-w-sm mb-4 leading-relaxed font-mono">
          {currentRepo.local_path}
        </p>
        <span className="text-xs text-subtext0">
          Comparing branches to compute 3-dot Virtual MR diff...
        </span>
      </div>
    );
  }

  // Overview screen when repo is open but no file selected
  if (!selectedFile) {
    const totalFiles = diffPayload.files.length;
    const totalBinaryFiles = diffPayload.files.filter((file) => file.is_binary).length;
    const totalAdditions = diffPayload.files.reduce((acc, f) => acc + f.additions, 0);
    const totalDeletions = diffPayload.files.reduce((acc, f) => acc + f.deletions, 0);

    if (totalFiles === 0) {
      const sameCommit = diffPayload.base_commit === diffPayload.compare_commit;
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-base p-8 text-center select-none">
          <div className="w-14 h-14 bg-surface0/60 border border-surface1 flex items-center justify-center text-subtext1 mb-4">
            <GitBranch className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-text mb-1.5">
            {sameCommit ? 'These branches point to the same commit' : 'No file changes to review'}
          </h3>
          <p className="text-xs text-subtext1 max-w-lg leading-relaxed">
            {sameCommit ? (
              <>Both <code className="font-mono text-text">{baseBranch}</code> and <code className="font-mono text-text">{compareBranch}</code> resolve to the same commit.</>
            ) : (
              <>The compare branch <code className="font-mono text-text">{compareBranch}</code> has no file changes relative to the merge base with <code className="font-mono text-text">{baseBranch}</code>.</>
            )}
          </p>
          <p className="text-xs text-subtext0 mt-2">Choose different branches or refresh the comparison if you expected changes.</p>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-base p-8 text-center select-none">
        <div className="w-16 h-16 rounded-xl bg-mantle border border-surface0 flex items-center justify-center text-subtext1 mb-4 shadow-md">
          <FileText className="w-8 h-8 text-blue" />
        </div>
        <h3 className="text-[1rem] font-bold text-text mb-1">
          Branch Comparison Ready
        </h3>
        <p className="text-xs text-subtext1 max-w-sm mb-6 leading-relaxed">
          Comparing <code className="text-blue font-mono font-semibold">{compareBranch}</code> into <code className="text-blue font-mono font-semibold">{baseBranch}</code>.
        </p>

        {/* Quick Summary Pill Cards */}
        <div className={`grid ${totalBinaryFiles > 0 ? 'grid-cols-4 max-w-xl' : 'grid-cols-3 max-w-md'} gap-3 w-full mb-6`}>
          <div className="bg-mantle border border-surface0 rounded-lg p-3 text-center">
            <div className="text-[10px] uppercase font-bold text-subtext1">Files</div>
            <div className="text-lg font-mono font-bold text-text">{totalFiles}</div>
          </div>
          <div className="bg-mantle border border-surface0 rounded-lg p-3 text-center">
            <div className="text-[10px] uppercase font-bold text-subtext1">Additions</div>
            <div className="text-lg font-mono font-bold text-green">+{totalAdditions}</div>
          </div>
          <div className="bg-mantle border border-surface0 rounded-lg p-3 text-center">
            <div className="text-[10px] uppercase font-bold text-subtext1">Deletions</div>
            <div className="text-lg font-mono font-bold text-red">-{totalDeletions}</div>
          </div>
          {totalBinaryFiles > 0 && (
            <div className="bg-mantle border border-surface0 rounded-lg p-3 text-center">
              <div className="text-[10px] uppercase font-bold text-subtext1">Binary</div>
              <div className="text-lg font-mono font-bold text-amber-400">{totalBinaryFiles}</div>
            </div>
          )}
        </div>

        <p className="text-xs text-subtext0">
          Select any file from the sidebar to inspect its side-by-side or unified diff.
        </p>
      </div>
    );
  }

  // Render Diff for Selected File
  const pathParts = selectedFile.path.split('/');
  const fileName = pathParts.pop();
  const dirPath = pathParts.join('/');

  return (
    <section className="flex-1 flex flex-col h-full bg-base overflow-hidden select-none">
      {/* File Diff Header Toolbar (Fork / GitHub Desktop style) */}
      <div className="h-11 border-b border-surface0 bg-mantle px-3.5 flex items-center justify-between shrink-0 relative z-20">
        {/* Left: Breadcrumbs & Copy Path */}
        <div className="flex items-center gap-2.5 min-w-0">
          <FileCode className="w-4 h-4 text-blue shrink-0" />
          <div className="flex items-center gap-1 min-w-0 font-mono text-xs">
            {dirPath && (
              <span className="text-subtext1 truncate max-w-[200px]">
                {dirPath}/
              </span>
            )}
            <span className="font-bold text-text truncate">
              {fileName}
            </span>
            {selectedFile.old_path && (
              <span className="text-subtext1 text-[11px] truncate ml-1">
                (renamed from {selectedFile.old_path})
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleCopyPath}
            title={formatShortcutText('Copy relative file path (Ctrl+Shift+C)')}
            className="p-1 text-subtext1 hover:text-text rounded hover:bg-surface1 transition-colors cursor-pointer"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          <FileActionMenu file={selectedFile} />

          {selectedFile.is_conflicted && (
            <div className="flex items-center gap-1 text-[10px] text-red bg-red/20 border border-red/40 px-2 py-0.5 rounded font-bold uppercase conflict-pulse">
              <AlertTriangle className="w-3.5 h-3.5 text-red" />
              <span>Conflict</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 font-mono text-xs ml-1 font-semibold">
            {selectedFile.is_binary ? (
              <span className="text-amber-400">Binary · preview unavailable</span>
            ) : (
              <>
                {selectedFile.additions > 0 && (
                  <span className="text-green">+{selectedFile.additions}</span>
                )}
                {selectedFile.deletions > 0 && (
                  <span className="text-red">-{selectedFile.deletions}</span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Center: File Stepper & Conflict Stepper */}
        <div className="flex items-center gap-2">
          {diffPayload && diffPayload.files.length > 1 && (
            <div className="flex items-center gap-1 bg-surface0 rounded border border-surface0 px-1 py-0.5">
              <button
                type="button"
                disabled={!hasPrev}
                onClick={selectPrevFile}
                className="p-1 text-subtext1 hover:text-text rounded hover:bg-surface1 transition-colors disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                title="Previous file (Up / k)"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] text-subtext1 font-mono px-1.5">
                {currentFileIndex + 1} of {diffPayload.files.length}
              </span>
              <button
                type="button"
                disabled={!hasNext}
                onClick={selectNextFile}
                className="p-1 text-subtext1 hover:text-text rounded hover:bg-surface1 transition-colors disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                title="Next file (Down / j)"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {conflictedFiles.length > 0 && (
            <div className="flex items-center gap-1 bg-red/15 border border-red/35 rounded px-1.5 py-0.5 shadow-xs">
              <AlertTriangle className="w-3.5 h-3.5 text-red shrink-0" />
              <button
                type="button"
                onClick={selectPrevConflictFile}
                className="p-0.5 text-red hover:bg-red/20 rounded transition-colors cursor-pointer"
                title="Previous conflict file"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={selectNextConflictFile}
                className="text-[11px] font-mono font-bold text-red hover:underline px-0.5 cursor-pointer"
                title={formatShortcutText('Jump to next conflict file (Alt+C)')}
              >
                {selectedFile?.is_conflicted && currentConflictIndex !== -1
                  ? `Conflict ${currentConflictIndex + 1}/${conflictedFiles.length}`
                  : formatShortcutText(`${conflictedFiles.length} Conflict${conflictedFiles.length > 1 ? 's' : ''} (Alt+C)`)}
              </button>
              <button
                type="button"
                onClick={selectNextConflictFile}
                className="p-0.5 text-red hover:bg-red/20 rounded transition-colors cursor-pointer"
                title={formatShortcutText('Next conflict file (Alt+C)')}
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Right: View Mode Toggle & Diff/Blame Switcher */}
        <div className="flex items-center gap-2">
          {/* Diff / Blame / Conflict Tab Switcher */}
          <div className="flex items-center bg-surface0 p-0.5 gap-0.5">
            {selectedFile?.is_conflicted && !selectedFile.is_binary && (
              <button
                type="button"
                onClick={() => setFileViewTab('conflicts')}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer ${
                  fileViewTab === 'conflicts'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'bg-surface1 text-white hover:bg-surface2'
                }`}
                title="Inspect 3-way collision blocks side-by-side"
              >
                <GitMerge className="w-3.5 h-3.5 text-white" />
                <span>Conflicts 3-Way</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setFileViewTab('diff')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                fileViewTab === 'diff'
                  ? 'bg-surface2 text-white shadow-xs'
                  : 'bg-surface0 text-white/80 hover:text-white hover:bg-surface1'
              }`}
              title="Inspect file diff"
            >
              <FileCode className="w-3.5 h-3.5 text-white" />
              <span>Diff</span>
            </button>
            {!selectedFile.is_binary && (
              <button
                type="button"
                onClick={() => setFileViewTab('blame')}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                  fileViewTab === 'blame'
                    ? 'bg-surface2 text-white shadow-xs'
                    : 'bg-surface0 text-white/80 hover:text-white hover:bg-surface1'
                }`}
                title={formatShortcutText('Inspect line-by-line git blame (Alt+B)')}
              >
                <History className="w-3.5 h-3.5 text-white" />
                <span>Blame</span>
              </button>
            )}
          </div>

          {/* Split / Unified Segmented Control (only when in Diff mode) */}
          {fileViewTab === 'diff' && (
            <div className="flex items-center bg-surface0 p-0.5 gap-0.5">
              <button
                type="button"
                onClick={() => onToggleViewMode('split')}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                  viewMode === 'split'
                    ? 'bg-surface2 text-white shadow-xs'
                    : 'bg-surface0 text-white/80 hover:text-white hover:bg-surface1'
                }`}
                title="Side-by-side split view"
              >
                <Columns2 className="w-3.5 h-3.5 text-white" />
                <span>Split</span>
              </button>
              <button
                type="button"
                onClick={() => onToggleViewMode('unified')}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                  viewMode === 'unified'
                    ? 'bg-surface2 text-white shadow-xs'
                    : 'bg-surface0 text-white/80 hover:text-white hover:bg-surface1'
                }`}
                title="Inline unified view"
              >
                <Rows2 className="w-3.5 h-3.5 text-white" />
                <span>Unified</span>
              </button>
            </div>
          )}

          {/* Inline Blame Toggle Button */}
          {fileViewTab === 'diff' && (
            <button
              type="button"
              onClick={toggleInlineBlame}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                showInlineBlame
                  ? 'bg-surface2 text-white shadow-xs'
                  : 'bg-surface1 text-white/80 hover:text-white hover:bg-surface2'
              }`}
              title={formatShortcutText(`Toggle inline git blame on active line (Alt+Shift+B) - ${showInlineBlame ? 'Active' : 'Disabled'}`)}
            >
              <GitCommit className="w-3.5 h-3.5 text-white" />
              <span>Inline Blame</span>
            </button>
          )}
        </div>
      </div>

      {/* Conflicted File Notification & External Resolution Action Bar */}
      {selectedFile.is_conflicted && (
        <div className="bg-red/10 border-b border-red/30 px-3.5 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-text select-none shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1 rounded bg-red/20 text-red border border-red/30 shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-red">
                  Unmerged Conflict in this file
                </span>
                {conflictReport?.details?.find((d) => d.path === selectedFile.path)?.conflict_type && (
                  <span className="text-[10px] uppercase px-1.5 py-0.2 rounded bg-surface1 text-subtext1 font-bold">
                    {conflictReport.details.find((d) => d.path === selectedFile.path)?.conflict_type}
                  </span>
                )}
                {conflictReport?.details?.find((d) => d.path === selectedFile.path)?.conflict_markers_count ? (
                  <span className="text-[10px] text-red font-semibold">
                    ({conflictReport.details.find((d) => d.path === selectedFile.path)?.conflict_markers_count} active marker(s) on disk)
                  </span>
                ) : null}
              </div>
              <p className="text-[11px] text-subtext1 mt-0.5 truncate max-w-2xl">
                {conflictReport?.details?.find((d) => d.path === selectedFile.path)?.message ||
                  'Stage0 is a virtual sandbox and does not modify your repository. Please resolve this conflict in your external editor.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!selectedFile.is_binary && (
              <>
                <button
                  type="button"
                  onClick={() => setFileViewTab('conflicts')}
                  className="flex items-center gap-1.5 px-3 py-1 bg-red-600 hover:bg-red-500 text-white font-bold transition-colors cursor-pointer text-xs shadow-xs"
                  title="Inspect 3-way collision blocks side-by-side"
                >
                  <GitMerge className="w-3.5 h-3.5 text-white" />
                  <span>
                    3-Way Conflict View {activeConflictPreview?.conflict_regions.length ? `(${activeConflictPreview.conflict_regions.length})` : ''}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={scrollToFirstConflict}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-surface1 hover:bg-surface2 text-white font-semibold transition-colors cursor-pointer text-xs shadow-xs"
                  title="Scroll directly to conflict marker or first conflict change in this file"
                >
                  <ArrowDown className="w-3.5 h-3.5 text-white" />
                  <span>Jump to Conflict</span>
                </button>
              </>
            )}

            {currentRepo && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await openFileInEditor(currentRepo.local_path, selectedFile.path);
                    showToast(`Opened ${selectedFile.path} in VS Code`);
                  } catch (err) {
                    showToast(`Failed to open in VS Code: ${err}`);
                  }
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-surface1 hover:bg-surface2 text-white font-medium transition-colors cursor-pointer text-xs"
                title="Open this file directly in Visual Studio Code to resolve conflict"
              >
                <Code2 className="w-3.5 h-3.5 text-white" />
                <span>Resolve in VS Code</span>
              </button>
            )}

            <button
              type="button"
              onClick={refreshDiff}
              className="flex items-center gap-1.5 px-2 py-1 bg-surface1 hover:bg-surface2 text-white font-medium transition-colors cursor-pointer text-xs"
              title={formatShortcutText('Re-check diff after resolving conflict in external tool (Ctrl+R)')}
            >
              <RotateCw className="w-3 h-3 text-white" />
              <span>Refresh Diff</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Area: Conflict View, Blame View, or Visual Diff */}
      {fileViewTab === 'conflicts' && selectedFile?.is_conflicted && !selectedFile.is_binary ? (
        <ConflictViewer onSwitchToDiff={() => setFileViewTab('diff')} />
      ) : fileViewTab === 'blame' && !selectedFile.is_binary ? (
        <BlameViewer />
      ) : (
        <div
          ref={diffContainerRef}
          onClick={handleDiffClick}
          className="flex-1 overflow-auto bg-base p-2 relative"
        >
          {/* Conflict Alert & Quick Summary Card inside Diff View */}
          {!selectedFile.is_binary && selectedFile.is_conflicted && activeConflictPreview && activeConflictPreview.conflict_regions.length > 0 && (
            <div className="mb-3 border border-red/40 bg-gradient-to-r from-red/15 via-red/10 to-red/5 rounded-lg p-3 shadow-xs">
              <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red shrink-0" />
                  <span className="text-xs font-bold text-red uppercase tracking-wider">
                    Merge Conflict Collision ({activeConflictPreview.conflict_regions.length} block{activeConflictPreview.conflict_regions.length > 1 ? 's' : ''})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setFileViewTab('conflicts')}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-red text-white text-xs font-bold hover:bg-red/90 transition-colors cursor-pointer shadow-xs"
                >
                  <GitMerge className="w-3.5 h-3.5" />
                  <span>Open 3-Way Side-by-Side Inspector</span>
                </button>
              </div>
              <p className="text-[11px] text-subtext1 mb-2 leading-relaxed">
                Standard git diff only compares against the common ancestor. Both <code className="text-text font-semibold bg-surface0 px-1 py-0.5 rounded border border-surface1">{baseBranch}</code> and <code className="text-text font-semibold bg-surface0 px-1 py-0.5 rounded border border-surface1">{compareBranch}</code> modified overlapping lines in this file:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
                {activeConflictPreview.conflict_regions.slice(0, 2).map((r, idx) => (
                  <div key={idx} className="bg-mantle/90 border border-surface0 rounded p-2 text-[11px]">
                    <div className="text-[10px] font-bold text-red mb-1">
                      Collision Region #{idx + 1} (Lines {r.start_line} – {r.end_line})
                    </div>
                    <div className="text-subtext0 truncate max-w-full">
                      <span className="text-red font-semibold">Target ({baseBranch}):</span> {r.base_code.split('\n')[0] || '(empty)'}
                    </div>
                    <div className="text-subtext0 truncate max-w-full">
                      <span className="text-blue font-semibold">Source ({compareBranch}):</span> {r.compare_code.split('\n')[0] || '(empty)'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Line-level & File-level Virtual MR Discussions */}
          <DiffDiscussionsBanner selectedFile={selectedFile} />

          {selectedFile.is_binary ? (
            <div className="flex min-h-64 h-full flex-col items-center justify-center px-6 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center border border-amber-400/30 bg-amber-400/10 text-amber-400">
                <FileWarning className="h-6 w-6" />
              </div>
              <h3 className="mb-1 text-sm font-semibold text-text">Binary file — diff preview not supported</h3>
              <p className="max-w-md text-xs leading-relaxed text-subtext1">
                Git detected binary content in this file. Stage0 can track the file change, but cannot render a text diff for it.
              </p>
              <p className="mt-2 text-[11px] text-subtext0">
                Use the file actions above to reveal it and inspect it with an external application.
              </p>
            </div>
          ) : diffData && hunks.length > 0 ? (
            <div className="border border-surface0 rounded-lg overflow-hidden bg-base shadow-sm">
              <DiffView
                key={`${selectedFile.path}-${viewMode}-${theme}-${fontFamily}-${fontSize}-${lineSpacing}-${enableLigatures}-${isBold}-${isItalic}-${isUnderline}`}
                data={diffData}
                className="diff-viewer-container"
                diffViewMode={
                  viewMode === 'split' ? DiffModeEnum.Split : DiffModeEnum.Unified
                }
                diffViewTheme={theme === 'mocha' ? 'dark' : 'light'}
                diffViewHighlight={true}
                diffViewWrap={false}
                diffViewFontSize={fontSize}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-subtext1 text-xs space-y-1">
              <CheckCircle2 className="w-8 h-8 text-green mb-2" />
              <p className="font-semibold text-text">No textual difference</p>
              <span className="text-[11px] text-subtext0">
                File status: {selectedFile.status} (empty or mode change)
              </span>
            </div>
          )}

          {/* Inline Blame React Portal mounted inside active line TD */}
          {showInlineBlame &&
            !selectedFile.is_binary &&
            portalMount &&
            activeBlameCommit &&
            activeLine &&
            createPortal(
              <InlineBlame
                commit={activeBlameCommit}
                lineNo={activeLine.lineNo}
                currentUser={{
                  name: blamePayload?.current_user_name,
                  email: blamePayload?.current_user_email,
                }}
                remoteUrl={remoteUrl}
                onOpenFullBlame={() => setFileViewTab('blame')}
                showToast={showToast}
              />,
              portalMount
            )}
        </div>
      )}
    </section>
  );
};
