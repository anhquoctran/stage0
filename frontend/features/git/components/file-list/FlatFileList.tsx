import type { FlatFileListProps } from './FlatFileListProps';

export function FlatFileList({
  filteredFiles,
  selectedFile,
  splitPath,
  onSelectFile,
  handleContextMenu,
  getStatusBadge,
}: FlatFileListProps) {
  return (
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
                <span
                  className="shrink-0 text-[9px] font-bold text-amber-400"
                  title="Binary file; diff preview is not supported"
                >
                  BIN
                </span>
              )}
              <div className="min-w-0 font-mono leading-tight">
                {dir && <span className="text-subtext1 text-[11px] block truncate">{dir}</span>}
                <span
                  className={`truncate font-medium block ${isSelected ? 'text-text' : 'text-text'}`}
                >
                  {fileName}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-mono shrink-0">
              {file.additions > 0 && <span className="text-green">+{file.additions}</span>}
              {file.deletions > 0 && <span className="text-red">-{file.deletions}</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
}
