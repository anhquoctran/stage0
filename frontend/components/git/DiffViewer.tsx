import React, { useMemo, useState } from 'react';
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
  AlertTriangle,
  FolderOpen,
  Eye,
  Code,
  ChevronLeft,
  ChevronRight,
  GitPullRequest,
  CheckCircle2,
} from 'lucide-react';
import { ChangedFile, MrDiffPayload, ViewMode } from '../../types/git';
import { extractFileHunks, inferLanguage } from '../../utils/diffParser';
import { useGitStore } from '../../store/useGitStore';
import { useThemeStore } from '../../store/useThemeStore';

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
  const { selectNextFile, selectPrevFile, baseBranch, compareBranch } = useGitStore();
  const { theme } = useThemeStore();
  const [copied, setCopied] = useState(false);
  const [showRawPatch, setShowRawPatch] = useState(false);

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

  // Welcome Screen when no repository is open (GitHub Desktop / Fork style)
  if (!diffPayload) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-base p-8 text-center select-none">
        <div className="w-20 h-20 rounded-2xl bg-mantle border border-surface0 flex items-center justify-center text-blue mb-5 shadow-2xl">
          <GitPullRequest className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-bold text-text mb-2 tracking-tight">
          Welcome to Stage0
        </h2>
        <p className="text-xs text-subtext1 max-w-md mb-6 leading-relaxed">
          Stage0 provides a local-first Virtual MR / PR Sandbox. Inspect branch differences, 3-dot diffs, and real-time merge conflict predictions with zero disk writes.
        </p>
        {onOpenRepo && (
          <button
            type="button"
            onClick={onOpenRepo}
            className="flex items-center gap-2.5 px-6 py-2.5 bg-surface1 hover:bg-surface2 text-text border border-surface2 hover:border-blue/50 rounded-lg text-xs font-semibold shadow-lg shadow-crust/60 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <FolderOpen className="w-4 h-4 text-blue shrink-0" />
            <span>Open Local Git Repository</span>
          </button>
        )}
      </div>
    );
  }

  // Overview screen when repo is open but no file selected
  if (!selectedFile) {
    const totalFiles = diffPayload.files.length;
    const totalAdditions = diffPayload.files.reduce((acc, f) => acc + f.additions, 0);
    const totalDeletions = diffPayload.files.reduce((acc, f) => acc + f.deletions, 0);

    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-base p-8 text-center select-none">
        <div className="w-16 h-16 rounded-xl bg-mantle border border-surface0 flex items-center justify-center text-subtext1 mb-4 shadow-md">
          <FileText className="w-8 h-8 text-blue" />
        </div>
        <h3 className="text-base font-bold text-text mb-1">
          Branch Comparison Ready
        </h3>
        <p className="text-xs text-subtext1 max-w-sm mb-6 leading-relaxed">
          Comparing <code className="text-blue font-mono font-semibold">{compareBranch}</code> into <code className="text-blue font-mono font-semibold">{baseBranch}</code>.
        </p>

        {/* Quick Summary Pill Cards */}
        <div className="grid grid-cols-3 gap-3 max-w-md w-full mb-6">
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
      <div className="h-11 border-b border-surface0 bg-mantle px-3.5 flex items-center justify-between shrink-0">
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
            title="Copy relative file path"
            className="p-1 text-subtext1 hover:text-text rounded hover:bg-surface1 transition-colors"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          {selectedFile.is_conflicted && (
            <div className="flex items-center gap-1 text-[10px] text-red bg-red/20 border border-red/40 px-2 py-0.5 rounded font-bold uppercase conflict-pulse">
              <AlertTriangle className="w-3.5 h-3.5 text-red" />
              <span>Conflict</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 font-mono text-xs ml-1 font-semibold">
            {selectedFile.additions > 0 && (
              <span className="text-green">+{selectedFile.additions}</span>
            )}
            {selectedFile.deletions > 0 && (
              <span className="text-red">-{selectedFile.deletions}</span>
            )}
          </div>
        </div>

        {/* Center: File Stepper (Prev / Next File) */}
        {diffPayload && diffPayload.files.length > 1 && (
          <div className="flex items-center gap-1 bg-surface0 rounded border border-surface0 px-1 py-0.5">
            <button
              type="button"
              disabled={!hasPrev}
              onClick={selectPrevFile}
              className="p-1 text-subtext1 hover:text-text rounded hover:bg-surface1 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
              title="Previous file"
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
              className="p-1 text-subtext1 hover:text-text rounded hover:bg-surface1 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
              title="Next file"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Right: View Mode & Raw Patch Toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowRawPatch(!showRawPatch)}
            title={showRawPatch ? 'Switch to Visual Diff' : 'Switch to Raw Patch'}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${
              showRawPatch
                ? 'bg-blue/25 border-blue/50 text-blue'
                : 'bg-surface0 border-surface0 text-text hover:bg-surface1'
            }`}
          >
            {showRawPatch ? (
              <>
                <Eye className="w-3.5 h-3.5 text-blue" />
                <span>Visual</span>
              </>
            ) : (
              <>
                <Code className="w-3.5 h-3.5 text-subtext1" />
                <span>Raw</span>
              </>
            )}
          </button>

          {/* Split / Unified Segmented Control */}
          <div className="flex items-center bg-surface0 rounded-md p-0.5 border border-surface0">
            <button
              type="button"
              onClick={() => onToggleViewMode('split')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                viewMode === 'split'
                  ? 'bg-blue text-white shadow-xs'
                  : 'text-subtext1 hover:text-text'
              }`}
              title="Side-by-side split view"
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span>Split</span>
            </button>
            <button
              type="button"
              onClick={() => onToggleViewMode('unified')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                viewMode === 'unified'
                  ? 'bg-blue text-white shadow-xs'
                  : 'text-subtext1 hover:text-text'
              }`}
              title="Inline unified view"
            >
              <Rows2 className="w-3.5 h-3.5" />
              <span>Unified</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Diff Rendering Area */}
      <div className="flex-1 overflow-auto bg-base p-2">
        {showRawPatch ? (
          <pre className="p-4 bg-mantle border border-surface0 rounded-lg font-mono text-xs text-text overflow-auto whitespace-pre leading-relaxed select-text">
            {hunks.length > 0
              ? hunks.join('\n\n')
              : 'No patch content found for this file.'}
          </pre>
        ) : diffData && hunks.length > 0 ? (
          <div className="border border-surface0 rounded-lg overflow-hidden bg-base shadow-sm">
            <DiffView
              key={`${selectedFile.path}-${viewMode}-${theme}`}
              data={diffData}
              diffViewMode={
                viewMode === 'split' ? DiffModeEnum.Split : DiffModeEnum.Unified
              }
              diffViewTheme={theme === 'mocha' ? 'dark' : 'light'}
              diffViewHighlight={true}
              diffViewWrap={false}
              diffViewFontSize={13}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-subtext1 text-xs space-y-1">
            <CheckCircle2 className="w-8 h-8 text-green mb-2" />
            <p className="font-semibold text-text">No textual difference</p>
            <span className="text-[11px] text-subtext0">
              File status: {selectedFile.status} (Binary, empty, or mode change)
            </span>
          </div>
        )}
      </div>
    </section>
  );
};
