import { AlertTriangle } from '../../../../common/components/icons/AlertTriangle';
import { FolderTree } from '../../../../common/components/icons/FolderTree';
import { List } from '../../../../common/components/icons/List';
import { Search } from '../../../../common/components/icons/Search';
import { X } from '../../../../common/components/icons/X';
import type { FileListFilterBarProps } from './FileListFilterBarProps';
import { useTranslation } from 'react-i18next';

export function FileListFilterBar({
  files,
  setFileListLayout,
  fileListLayout,
  binaryCount,
  totalAdditions,
  totalDeletions,
  searchTerm,
  setSearchTerm,
  conflictedCount,
  setFilterConflictedOnly,
  filterConflictedOnly,
}: FileListFilterBarProps) {
  const { t } = useTranslation();
  return (
    <div className="p-2.5 border-b border-surface0 bg-mantle space-y-2 rounded-sm">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-bold uppercase tracking-wider text-subtext1">
            {t('git.diff.empty.files')}
          </span>
          <span className="text-xs px-1.5 py-0.2 bg-surface0 text-text rounded-sm font-mono font-semibold border border-surface0">
            {files.length}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Flat vs Tree toggle */}
          <div className="flex items-center bg-surface0 rounded-sm p-0.5 gap-0.5">
            <button
              type="button"
              onClick={() => setFileListLayout('flat')}
              className={`p-1 rounded-sm transition-colors ${
                fileListLayout === 'flat'
                  ? 'bg-surface2 text-white'
                  : 'text-white/70 hover:text-white'
              }`}
              title={t('menu.commands.file_list_flat')}
            >
              <List className="w-3.5 h-3.5 text-white" />
            </button>
            <button
              type="button"
              onClick={() => setFileListLayout('tree')}
              className={`p-1 rounded-sm transition-colors ${
                fileListLayout === 'tree'
                  ? 'bg-surface2 text-white'
                  : 'text-white/70 hover:text-white'
              }`}
              title={t('menu.commands.file_list_tree')}
            >
              <FolderTree className="w-3.5 h-3.5 text-white" />
            </button>
          </div>

          {/* Total Lines Changed */}
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold">
            {binaryCount > 0 && (
              <span
                className="text-amber-400"
                title={t('git.diff.binary.title')}
              >
                {binaryCount} BIN
              </span>
            )}
            <span className="text-green">+{totalAdditions}</span>
            <span className="text-red">-{totalDeletions}</span>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute start-2.5 top-1/2 -translate-y-1/2 text-subtext1" />
        <input
          type="text"
          placeholder={t('git.fileList.filterPlaceholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full ps-8 pe-7 py-1 bg-base border border-surface0 rounded-sm text-xs text-text placeholder-subtext0 focus:outline-none focus:border-blue focus:ring-1 focus:ring-blue"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="absolute end-2 top-1/2 -translate-y-1/2 text-subtext1 hover:text-text rounded-sm"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Conflict Quick Filter Pill */}
      {conflictedCount > 0 && (
        <button
          type="button"
          onClick={() => setFilterConflictedOnly(!filterConflictedOnly)}
          className={`w-full flex items-center justify-between px-2.5 py-1 text-xs font-semibold transition-colors rounded-sm ${
            filterConflictedOnly
              ? 'bg-red-600 text-white'
              : 'bg-surface1 text-white hover:bg-surface2'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-white shrink-0" />
            <span>{t('git.fileList.showConflictsOnly')}</span>
          </div>
          <span className="bg-red-700 text-white px-1.5 py-0.2 rounded-sm font-mono text-[10px]">
            {conflictedCount}
          </span>
        </button>
      )}
    </div>
  );
}
