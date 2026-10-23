import { ChevronDown } from '../../../../common/components/icons/ChevronDown';
import { ChevronRight } from '../../../../common/components/icons/ChevronRight';
import { Folder } from '../../../../common/components/icons/Folder';
import { FolderOpen } from '../../../../common/components/icons/FolderOpen';
import type { FolderFileListProps } from './FolderFileListProps';

export function FolderFileList({
  folderTree,
  collapsedFolders,
  toggleFolder,
  selectedFile,
  onSelectFile,
  handleContextMenu,
  getStatusBadge,
}: FolderFileListProps) {
  return (
    <div className="py-1">
      {Object.entries(folderTree).map(([folder, folderFiles]) => {
        const isCollapsed = collapsedFolders[folder];
        const folderLabel = folder === '.' ? 'Root' : folder;

        return (
          <div key={folder} className="mb-0.5">
            <button
              type="button"
              onClick={() => toggleFolder(folder)}
              className="w-full text-left px-2.5 py-1 text-xs font-semibold text-subtext1 hover:text-text hover:bg-mantle flex items-center justify-between transition-colors rounded-sm"
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
              <span className="text-[10px] text-subtext0 font-mono px-1">{folderFiles.length}</span>
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
                      className={`w-full text-left px-2.5 py-1.5 text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer rounded-sm ${
                        isSelected
                          ? 'bg-blue/15 border-l-2 border-blue text-text'
                          : 'text-text hover:bg-mantle border-l-2 border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {getStatusBadge(file.status, file.is_conflicted)}
                        {file.is_binary && (
                          <span
                            className="shrink-0 text-[9px] font-bold text-amber-400"
                            title="Binary file; diff preview is not supported"
                          >
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
                        {file.deletions > 0 && <span className="text-red">-{file.deletions}</span>}
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
  );
}
