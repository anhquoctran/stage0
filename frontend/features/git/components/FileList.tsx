import React, { useState, useMemo } from 'react';
import { AlertTriangle } from '../../../common/components/icons/AlertTriangle';
import { Search } from '../../../common/components/icons/Search';
import { X } from '../../../common/components/icons/X';
import { List } from '../../../common/components/icons/List';
import { FolderTree } from '../../../common/components/icons/FolderTree';
import { Folder } from '../../../common/components/icons/Folder';
import { FolderOpen } from '../../../common/components/icons/FolderOpen';
import { ChevronRight } from '../../../common/components/icons/ChevronRight';
import { ChevronDown } from '../../../common/components/icons/ChevronDown';
import { type ChangedFile } from '../types/ChangedFile';
import { useGitStore } from '../store/useGitStore';
import { FileContextMenu } from './FileContextMenu';
import type { FileListProps } from '../types/FileListProps';

export const FileList: React.FC<FileListProps> = ({
  files,
  selectedFile,
  onSelectFile,
  isLoading = false,
  width,
}) => {
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
        (file.old_path &&
          file.old_path.toLowerCase().includes(searchTerm.toLowerCase()));
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
          className="w-4 h-4 rounded text-[10px] font-bold flex items-center justify-center bg-red/20 text-red border border-red/40 conflict-pulse shrink-0"
          title="Merge conflict"
        >
          !
        </span>
      );
    }

    switch (status) {
      case 'ADDED':
        return (
          <span
            className="w-4 h-4 rounded text-[10px] font-bold flex items-center justify-center bg-green/20 text-green border border-green/30 shrink-0"
            title="Added file"
          >
            A
          </span>
        );
      case 'DELETED':
        return (
          <span
            className="w-4 h-4 rounded text-[10px] font-bold flex items-center justify-center bg-red/20 text-red border border-red/30 shrink-0"
            title="Deleted file"
          >
            D
          </span>
        );
      case 'RENAMED':
        return (
          <span
            className="w-4 h-4 rounded text-[10px] font-bold flex items-center justify-center bg-mauve/20 text-mauve border border-mauve/30 shrink-0"
            title="Renamed file"
          >
            R
          </span>
        );
      default:
        return (
          <span
            className="w-4 h-4 rounded text-[10px] font-bold flex items-center justify-center bg-yellow/20 text-yellow border border-yellow/30 shrink-0"
            title="Modified file"
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
      className={`flex flex-col h-full bg-base border-r border-surface0 shrink-0 select-none ${
        !width ? 'w-80' : ''
      }`}
    >
      {/* Sidebar Header */}
      <div className="p-2.5 border-b border-surface0 bg-mantle space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-subtext1">
              Files Changed
            </span>
            <span className="text-xs px-1.5 py-0.2 bg-surface0 text-text rounded-full font-mono font-semibold border border-surface0">
              {files.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Flat vs Tree toggle */}
            <div className="flex items-center bg-surface0 rounded p-0.5 gap-0.5">
              <button
                type="button"
                onClick={() => setFileListLayout('flat')}
                className={`p-1 rounded transition-colors ${
                  fileListLayout === 'flat'
                    ? 'bg-surface2 text-white'
                    : 'text-white/70 hover:text-white'
                }`}
                title="Flat list view"
              >
                <List className="w-3.5 h-3.5 text-white" />
              </button>
              <button
                type="button"
                onClick={() => setFileListLayout('tree')}
                className={`p-1 rounded transition-colors ${
                  fileListLayout === 'tree'
                    ? 'bg-surface2 text-white'
                    : 'text-white/70 hover:text-white'
                }`}
                title="Tree folder view"
              >
                <FolderTree className="w-3.5 h-3.5 text-white" />
              </button>
            </div>

            {/* Total Lines Changed */}
            <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold">
              {binaryCount > 0 && (
                <span className="text-amber-400" title={`${binaryCount} binary file${binaryCount === 1 ? '' : 's'}; diff preview is not supported`}>
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
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-subtext1" />
          <input
            type="text"
            placeholder="Filter files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-7 py-1 bg-base border border-surface0 rounded text-xs text-text placeholder-subtext0 focus:outline-none focus:border-blue focus:ring-1 focus:ring-blue"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-subtext1 hover:text-text"
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
            className={`w-full flex items-center justify-between px-2.5 py-1 text-xs font-semibold transition-colors ${
              filterConflictedOnly
                ? 'bg-red-600 text-white'
                : 'bg-surface1 text-white hover:bg-surface2'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-white shrink-0" />
              <span>Show Conflicts Only</span>
            </div>
            <span className="bg-red-700 text-white px-1.5 py-0.2 rounded-full font-mono text-[10px]">
              {conflictedCount}
            </span>
          </button>
        )}
      </div>

      {/* File List Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-subtext1 space-y-2">
            <div className="w-5 h-5 border-2 border-blue border-t-transparent rounded-full animate-spin mx-auto" />
            <p>Analyzing changes...</p>
          </div>
        ) : diffError ? (
          <div className="p-6 flex flex-col items-center gap-2 text-center text-xs text-red" title={diffError}>
            <AlertTriangle className="w-4 h-4" />
            <span>Comparison unavailable</span>
            <span className="text-subtext0">See the details in the comparison view.</span>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="p-6 text-center text-xs text-subtext0">
            {searchTerm
              ? 'No files match search query'
              : 'No file changes between branches'}
          </div>
        ) : fileListLayout === 'flat' ? (
          /* Flat File List */
          <div className="divide-y divide-surface0/60">
            {filteredFiles.map((file) => {
              const isSelected = selectedFile?.path === file.path;
              const { dir, file: fileName } = splitPath(file.path);

              return (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => onSelectFile(file)}
                  onContextMenu={(e) => handleContextMenu(e, file)}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-blue/15 border-l-2 border-blue text-text'
                      : 'text-text hover:bg-mantle border-l-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {getStatusBadge(file.status, file.is_conflicted)}
                    {file.is_binary && (
                      <span className="shrink-0 text-[9px] font-bold text-amber-400" title="Binary file; diff preview is not supported">
                        BIN
                      </span>
                    )}
                    <div className="min-w-0 font-mono leading-tight">
                      {dir && (
                        <span className="text-subtext1 text-[11px] block truncate">
                          {dir}
                        </span>
                      )}
                      <span className={`truncate font-medium block ${isSelected ? 'text-text' : 'text-text'}`}>
                        {fileName}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] font-mono shrink-0">
                    {file.additions > 0 && (
                      <span className="text-green">+{file.additions}</span>
                    )}
                    {file.deletions > 0 && (
                      <span className="text-red">-{file.deletions}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          /* Tree Folder View (Fork & GitKraken style) */
          <div className="py-1">
            {Object.entries(folderTree).map(([folder, folderFiles]) => {
              const isCollapsed = collapsedFolders[folder];
              const folderLabel = folder === '.' ? 'Root' : folder;

              return (
                <div key={folder} className="mb-0.5">
                  <button
                    type="button"
                    onClick={() => toggleFolder(folder)}
                    className="w-full text-left px-2.5 py-1 text-xs font-semibold text-subtext1 hover:text-text hover:bg-mantle flex items-center justify-between transition-colors"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {isCollapsed ? (
                        <ChevronRight className="w-3.5 h-3.5 text-subtext0 shrink-0" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-subtext0 shrink-0" />
                      )}
                      {isCollapsed ? (
                        <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      ) : (
                        <FolderOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      )}
                      <span className="truncate font-mono">{folderLabel}</span>
                    </div>
                    <span className="text-[10px] text-subtext0 font-mono px-1">
                      {folderFiles.length}
                    </span>
                  </button>

                  {!isCollapsed && (
                    <div className="pl-4 divide-y divide-surface0/40">
                      {folderFiles.map((file) => {
                        const isSelected = selectedFile?.path === file.path;
                        const fileName = file.path.split('/').pop() || file.path;

                        return (
                          <button
                            key={file.path}
                            type="button"
                            onClick={() => onSelectFile(file)}
                            onContextMenu={(e) => handleContextMenu(e, file)}
                            className={`w-full text-left px-2.5 py-1.5 text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-blue/15 border-l-2 border-blue text-text'
                                : 'text-text hover:bg-mantle border-l-2 border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {getStatusBadge(file.status, file.is_conflicted)}
                              {file.is_binary && (
                                <span className="shrink-0 text-[9px] font-bold text-amber-400" title="Binary file; diff preview is not supported">
                                  BIN
                                </span>
                              )}
                              <span className="truncate font-mono text-[12px] font-medium">
                                {fileName}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 text-[10px] font-mono shrink-0">
                              {file.additions > 0 && (
                                <span className="text-green">+{file.additions}</span>
                              )}
                              {file.deletions > 0 && (
                                <span className="text-red">-{file.deletions}</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
