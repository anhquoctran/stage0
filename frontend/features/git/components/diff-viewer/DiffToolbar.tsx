import React from 'react';
import { Columns2 } from '../../../../common/components/icons/Columns2';
import { Rows2 } from '../../../../common/components/icons/Rows2';
import { Copy } from '../../../../common/components/icons/Copy';
import { Check } from '../../../../common/components/icons/Check';
import { FileCode } from '../../../../common/components/icons/FileCode';
import { AlertTriangle } from '../../../../common/components/icons/AlertTriangle';
import { ChevronLeft } from '../../../../common/components/icons/ChevronLeft';
import { ChevronRight } from '../../../../common/components/icons/ChevronRight';
import { History } from '../../../../common/components/icons/History';
import { GitCommit } from '../../../../common/components/icons/GitCommit';
import { GitMerge } from '../../../../common/components/icons/GitMerge';
import { useCommandShortcut } from '../../../../core/hooks/useCommandShortcut';
import { useTranslation } from 'react-i18next';
import { FileActionMenu } from '../FileActionMenu';
import type { ChangedFile } from '../../types/ChangedFile';
import type { MrDiffPayload } from '../../types/MrDiffPayload';

export const DiffToolbar: React.FC<{
  selectedFile: ChangedFile;
  diffPayload: MrDiffPayload | null;
  viewMode: 'split' | 'unified';
  onToggleViewMode: (mode: 'split' | 'unified') => void;
  fileViewTab: 'diff' | 'blame' | 'conflicts';
  setFileViewTab: (tab: 'diff' | 'blame' | 'conflicts') => void;
  showInlineBlame: boolean;
  toggleInlineBlame: () => void;
  copied: boolean;
  onCopyPath: () => void;
  currentFileIndex: number;
  hasPrev: boolean;
  hasNext: boolean;
  selectPrevFile: () => void;
  selectNextFile: () => void;
  conflictedFiles: ChangedFile[];
  currentConflictIndex: number;
  selectPrevConflictFile: () => void;
  selectNextConflictFile: () => void;
}> = ({
  selectedFile,
  diffPayload,
  viewMode,
  onToggleViewMode,
  fileViewTab,
  setFileViewTab,
  showInlineBlame,
  toggleInlineBlame,
  copied,
  onCopyPath,
  currentFileIndex,
  hasPrev,
  hasNext,
  selectPrevFile,
  selectNextFile,
  conflictedFiles,
  currentConflictIndex,
  selectPrevConflictFile,
  selectNextConflictFile,
}) => {
  const pathParts = selectedFile.path.split('/');
  const { title: commandTitle } = useCommandShortcut();
  const { t } = useTranslation();
  const fileName = pathParts.pop();
  const dirPath = pathParts.join('/');

  return (
    <div className="min-h-11 h-auto border-b border-surface0 bg-mantle px-3.5 py-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 shrink-0 relative z-20 rounded-sm">
      {/* Left: Breadcrumbs & Copy Path */}
      <div className="flex items-center gap-2.5 min-w-0 flex-[1_1_320px]">
        <FileCode className="w-4 h-4 text-blue shrink-0" />
        <div className="flex items-center gap-1 min-w-0 font-mono text-xs">
          {dirPath && (
            <span className="text-subtext1 truncate max-w-[200px] max-xl:hidden">
              {dirPath}/
            </span>
          )}
          <span className="font-bold text-text truncate">
            {fileName}
          </span>
          {selectedFile.old_path && (
            <span className="text-subtext1 text-[11px] truncate ms-1 max-xl:hidden">
              ({t('git.diff.toolbar.renamedFrom', { path: selectedFile.old_path })})
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onCopyPath}
          title={commandTitle('copy_rel_path', t('menu.commands.copy_rel_path'))}
          className="p-1 text-subtext1 hover:text-text hover:bg-surface1 transition-colors cursor-pointer rounded-sm"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-green" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>

        <FileActionMenu file={selectedFile} />

        {selectedFile.is_conflicted && (
          <div className="flex items-center gap-1 text-[10px] text-red bg-red/20 border border-red/40 px-2 py-0.5 font-bold uppercase conflict-pulse rounded-sm">
            <AlertTriangle className="w-3.5 h-3.5 text-red" />
            <span>{t('git.conflicts.unmerged')}</span>
          </div>
        )}

        <div className="flex items-center gap-1.5 font-mono text-xs ms-1 font-semibold max-xl:hidden">
          {selectedFile.is_binary ? (
            <span className="text-amber-400">{t('git.diff.binary.title')}</span>
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
      <div className="flex items-center gap-2 shrink-0 max-xl:ms-auto">
        {diffPayload && diffPayload.files.length > 1 && (
          <div className="flex items-center gap-1 bg-surface0 border border-surface0 px-1 py-0.5 rounded-sm">
            <button
              type="button"
              disabled={!hasPrev}
              onClick={selectPrevFile}
              className="p-1 text-subtext1 hover:text-text hover:bg-surface1 transition-colors disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer rounded-sm"
              title={commandTitle('previous_file', t('menu.commands.previous_file'))}
            >
              <ChevronLeft className="w-3.5 h-3.5 rtl:rotate-180" />
            </button>
            <span className="text-[11px] text-subtext1 font-mono px-1.5">
              {currentFileIndex + 1} / {diffPayload.files.length}
            </span>
            <button
              type="button"
              disabled={!hasNext}
              onClick={selectNextFile}
              className="p-1 text-subtext1 hover:text-text hover:bg-surface1 transition-colors disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer rounded-sm"
              title={commandTitle('next_file', t('menu.commands.next_file'))}
            >
              <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </button>
          </div>
        )}

        {conflictedFiles.length > 0 && (
          <div className="flex items-center gap-1 bg-red/15 border border-red/35 px-1.5 py-0.5 shadow-xs rounded-sm">
            <AlertTriangle className="w-3.5 h-3.5 text-red shrink-0" />
            <button
              type="button"
              onClick={selectPrevConflictFile}
              className="p-0.5 text-red hover:bg-red/20 transition-colors cursor-pointer rounded-sm"
              title={t('git.conflicts.jumpTitle')}
            >
              <ChevronLeft className="w-3 h-3 rtl:rotate-180" />
            </button>
            <button
              type="button"
              onClick={selectNextConflictFile}
              className="text-[11px] font-mono font-bold text-red hover:underline px-0.5 cursor-pointer rounded-sm"
              title={commandTitle('next_conflict', t('git.diff.toolbar.nextConflictFile'))}
            >
              {selectedFile?.is_conflicted && currentConflictIndex !== -1
                ? `${currentConflictIndex + 1} / ${conflictedFiles.length}`
                : commandTitle('next_conflict', t('git.diff.conflict.threeWayCount', { count: conflictedFiles.length }))}
            </button>
            <button
              type="button"
              onClick={selectNextConflictFile}
              className="p-0.5 text-red hover:bg-red/20 transition-colors cursor-pointer rounded-sm"
              title={commandTitle('next_conflict', t('git.conflicts.jumpTitle'))}
            >
              <ChevronRight className="w-3 h-3 rtl:rotate-180" />
            </button>
          </div>
        )}
      </div>

      {/* Right: View Mode Toggle & Diff/Blame Switcher */}
      <div className="flex items-center gap-2 shrink-0 max-xl:basis-full max-xl:flex-wrap max-xl:justify-end max-xl:gap-y-1.5">
        {/* Diff / Blame / Conflict Tab Switcher */}
        <div className="flex items-center bg-surface0 p-0.5 gap-0.5 rounded-sm">
          {selectedFile?.is_conflicted && !selectedFile.is_binary && (
            <button
              type="button"
              onClick={() => setFileViewTab('conflicts')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer rounded-sm ${
                fileViewTab === 'conflicts'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-surface1 text-white hover:bg-surface2'
              }`}
              title={t('git.diff.conflict.inspectThreeWayTitle')}
            >
              <GitMerge className="w-3.5 h-3.5 text-white" />
              <span className="max-md:hidden">{t('git.diff.conflict.threeWayView')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setFileViewTab('diff')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer rounded-sm ${
              fileViewTab === 'diff'
                ? 'bg-surface2 text-white shadow-xs'
                : 'bg-surface0 text-white/80 hover:text-white hover:bg-surface1'
            }`}
            title={t('preferences.headers.editor-diff.title')}
          >
            <FileCode className="w-3.5 h-3.5 text-white" />
            <span className="max-md:hidden">{t('preferences.nav.editor-diff')}</span>
          </button>
          {!selectedFile.is_binary && (
            <button
              type="button"
              onClick={() => setFileViewTab('blame')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer rounded-sm ${
                fileViewTab === 'blame'
                  ? 'bg-surface2 text-white shadow-xs'
                  : 'bg-surface0 text-white/80 hover:text-white hover:bg-surface1'
              }`}
              title={commandTitle('view_blame', t('menu.commands.view_blame'))}
            >
              <History className="w-3.5 h-3.5 text-white" />
              <span className="max-md:hidden">{t('menu.commands.view_blame')}</span>
            </button>
          )}
        </div>

        {/* Split / Unified Segmented Control (only when in Diff mode) */}
        {fileViewTab === 'diff' && (
          <div className="flex items-center bg-surface0 p-0.5 gap-0.5 rounded-sm">
            <button
              type="button"
              onClick={() => onToggleViewMode('split')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer rounded-sm ${
                viewMode === 'split'
                  ? 'bg-surface2 text-white shadow-xs'
                  : 'bg-surface0 text-white/80 hover:text-white hover:bg-surface1'
              }`}
              title={t('menu.commands.view_split')}
            >
              <Columns2 className="w-3.5 h-3.5 text-white" />
              <span className="max-md:hidden">{t('common.layout.viewSplit')}</span>
            </button>
            <button
              type="button"
              onClick={() => onToggleViewMode('unified')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer rounded-sm ${
                viewMode === 'unified'
                  ? 'bg-surface2 text-white shadow-xs'
                  : 'bg-surface0 text-white/80 hover:text-white hover:bg-surface1'
              }`}
              title={t('menu.commands.view_unified')}
            >
              <Rows2 className="w-3.5 h-3.5 text-white" />
              <span className="max-md:hidden">{t('common.layout.viewUnified')}</span>
            </button>
          </div>
        )}

        {/* Inline Blame Toggle Button */}
        {fileViewTab === 'diff' && (
          <button
            type="button"
            onClick={toggleInlineBlame}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer rounded-sm ${
              showInlineBlame
                ? 'bg-surface2 text-white shadow-xs'
                : 'bg-surface1 text-white/80 hover:text-white hover:bg-surface2'
            }`}
            title={commandTitle('toggle_inline_blame', t('menu.commands.toggle_inline_blame'))}
          >
            <GitCommit className="w-3.5 h-3.5 text-white" />
            <span className="max-md:hidden">{t('menu.commands.toggle_inline_blame')}</span>
          </button>
        )}
      </div>
    </div>
  );
};
