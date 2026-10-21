import React from 'react';
import { FileText } from '../../../../common/components/icons/FileText';
import { useGitStore } from '../../../../features/git/store/useGitStore';

export const StatusBarFileProgress: React.FC = () => {
  const { diffPayload, selectedFile } = useGitStore();

  const totalFiles = diffPayload?.files.length || 0;
  if (totalFiles <= 0) return null;

  const currentFileIndex = selectedFile && diffPayload
    ? diffPayload.files.findIndex((f) => f.path === selectedFile.path) + 1
    : 0;

  return (
    <div
      className="h-5.5 px-2 bg-surface0/50 border border-surface1/60 text-subtext0 flex items-center gap-1.5 text-[11px] shadow-xs"
      title={selectedFile ? `Active file: ${selectedFile.path}` : `${totalFiles} total files`}
    >
      <FileText className="w-3 h-3 text-subtext0 shrink-0" />
      <span className="flex items-center gap-1">
        <span className="max-xl:hidden">File</span>
        <span className="font-mono font-semibold text-text">
          {currentFileIndex > 0 ? currentFileIndex : '–'}
        </span>
        <span className="text-subtext0/60 font-light max-xl:hidden">of</span>
        <span className="hidden max-xl:inline">/</span>
        <span className="font-mono font-semibold text-text">{totalFiles}</span>
      </span>
    </div>
  );
};

