import React, { useMemo, useState } from 'react';
import { AlertTriangle } from '../../../common/components/icons/AlertTriangle';
import { useGitStore } from '../store/useGitStore';
import { type ChangedFile } from '../types/ChangedFile';
import type { FileListProps } from '../types/FileListProps';
import { FileListFilterBar } from './file-list/FileListFilterBar';
import { FlatFileList } from './file-list/FlatFileList';
import { FolderFileList } from './file-list/FolderFileList';
import { FileContextMenu } from './FileContextMenu';
import { useTranslation } from 'react-i18next';

export const FileList: React.FC<FileListProps> = ({
  files,
  selectedFile,
  onSelectFile,
  isLoading = false,
  width,
}) => {
  const { t } = useTranslation();
  const { fileListLayout, setFileListLayout, diffError } = useGitStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterConflictedOnly, setFilterConflictedOnly] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    file: ChangedFile;
  } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, file: ChangedFile) => {
    e.preventDefault();
    onSelectFile(file);
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      file,
    });
  };

  const totalAdditions = files.reduce((acc, f) => acc + f.additions, 0);
  const totalDeletions = files.reduce((acc, f) => acc + f.deletions, 0);
  const binaryCount = files.filter((f) => f.is_binary).length;
  const conflictedCount = files.filter((f) => f.is_conflicted).length;

  const filteredFiles = useMemo(() => {
    return files.filter((file) => {
      const matchesSearch =
        file.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (file.old_path && file.old_path.toLowerCase().includes(searchTerm.toLowerCase()));
      if (!matchesSearch) return false;
      if (filterConflictedOnly && !file.is_conflicted) return false;
      return true;
    });
  }, [files, searchTerm, filterConflictedOnly]);

  const toggleFolder = (folderPath: string) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [folderPath]: !prev[folderPath],
    }));
  };

  // Auto-expand folder of selected file if collapsed
  React.useEffect(() => {
    if (!selectedFile) return;
    const parts = selectedFile.path.split('/');
    if (parts.length > 1) {
      const folder = parts.slice(0, -1).join('/');
      setCollapsedFolders((prev) => {
        if (prev[folder]) {
          const next = { ...prev };
          delete next[folder];
          return next;
        }
        return prev;
      });
    }
  }, [selectedFile]);

  // Group files into folder tree
  const folderTree = useMemo(() => {
    const tree: Record<string, ChangedFile[]> = {};
    for (const file of filteredFiles) {
      const parts = file.path.split('/');
      const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : '.';
      if (!tree[folder]) tree[folder] = [];
      tree[folder].push(file);
    }
    return tree;
  }, [filteredFiles]);

  const getStatusBadge = (status: string, isConflicted: boolean) => {
    if (isConflicted) {
      return (
        <span
          className="w-4 h-4 rounded-sm text-[10px] font-bold flex items-center justify-center bg-red/20 text-red border border-red/40 conflict-pulse shrink-0"
          title={t('git.conflicts.unmerged')}
        >
          !
        </span>
      );
    }

    switch (status) {
      case 'ADDED':
        return (
          <span
            className="w-4 h-4 rounded-sm text-[10px] font-bold flex items-center justify-center bg-green/20 text-green border border-green/30 shrink-0"
            title={t('git.fileList.status.added')}
          >
            A
          </span>
        );
      case 'DELETED':
        return (
          <span
            className="w-4 h-4 rounded-sm text-[10px] font-bold flex items-center justify-center bg-red/20 text-red border border-red/30 shrink-0"
            title={t('git.fileList.status.deleted')}
          >
            D
          </span>
        );
      case 'RENAMED':
        return (
          <span
            className="w-4 h-4 rounded-sm text-[10px] font-bold flex items-center justify-center bg-mauve/20 text-mauve border border-mauve/30 shrink-0"
            title={t('git.fileList.status.renamed')}
          >
            R
          </span>
        );
      default:
        return (
          <span
            className="w-4 h-4 rounded-sm text-[10px] font-bold flex items-center justify-center bg-yellow/20 text-yellow border border-yellow/30 shrink-0"
            title={t('git.fileList.status.modified')}
          >
            M
          </span>
        );
    }
  };

  const splitPath = (fullPath: string) => {
    const parts = fullPath.split('/');
    if (parts.length === 1) {
      return { dir: '', file: fullPath };
    }
    return {
      dir: parts.slice(0, -1).join('/') + '/',
      file: parts[parts.length - 1],
    };
  };

  return (
    <aside
      style={width ? { width: `${width}px` } : undefined}
      className={`flex flex-col h-full bg-base border-e border-surface0 shrink-0 select-none ${
        !width ? 'w-80' : ''
      }`}
    >
      {/* Sidebar Header */}
      <FileListFilterBar
        files={files}
        setFileListLayout={setFileListLayout}
        fileListLayout={fileListLayout}
        binaryCount={binaryCount}
        totalAdditions={totalAdditions}
        totalDeletions={totalDeletions}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        conflictedCount={conflictedCount}
        setFilterConflictedOnly={setFilterConflictedOnly}
        filterConflictedOnly={filterConflictedOnly}
      />

      {/* File List Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-subtext1 space-y-2">
            <div className="w-5 h-5 rounded-full border-2 border-blue border-t-transparent animate-spin mx-auto" />
            <p>{t('git.fileList.analyzing')}</p>
          </div>
        ) : diffError ? (
          <div
            className="p-6 flex flex-col items-center gap-2 text-center text-xs text-red"
            title={diffError}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>{t('compareStatus.unavailable')}</span>
            <span className="text-subtext0">{t('git.fileList.comparisonDetailsHint')}</span>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="p-6 text-center text-xs text-subtext0">
            {searchTerm ? t('git.fileList.noSearchMatches') : t('git.diff.empty.noChanges')}
          </div>
        ) : fileListLayout === 'flat' ? (
          /* Flat File List */
          <FlatFileList
            filteredFiles={filteredFiles}
            selectedFile={selectedFile}
            splitPath={splitPath}
            onSelectFile={onSelectFile}
            handleContextMenu={handleContextMenu}
            getStatusBadge={getStatusBadge}
          />
        ) : (
          /* Tree Folder View (Fork & GitKraken style) */
          <FolderFileList
            folderTree={folderTree}
            collapsedFolders={collapsedFolders}
            toggleFolder={toggleFolder}
            selectedFile={selectedFile}
            onSelectFile={onSelectFile}
            handleContextMenu={handleContextMenu}
            getStatusBadge={getStatusBadge}
          />
        )}
      </div>

      {/* Right-click Context Menu */}
      {contextMenu && (
        <FileContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          file={contextMenu.file}
          onClose={() => setContextMenu(null)}
        />
      )}
    </aside>
  );
};
