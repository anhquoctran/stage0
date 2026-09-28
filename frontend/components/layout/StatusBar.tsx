import React from 'react';
import {
  FolderGit2,
  GitBranch,
  ShieldCheck,
  AlertTriangle,
  Columns2,
  Rows2,
  Keyboard,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';

export const StatusBar: React.FC = () => {
  const {
    currentRepo,
    branches,
    diffPayload,
    conflictReport,
    selectedFile,
    viewMode,
  } = useGitStore();

  const totalFiles = diffPayload?.files.length || 0;
  const currentFileIndex = selectedFile && diffPayload
    ? diffPayload.files.findIndex((f) => f.path === selectedFile.path) + 1
    : 0;

  return (
    <footer className="h-7 bg-mantle border-t border-surface0 px-3 flex items-center justify-between text-[11px] text-subtext1 shrink-0 select-none z-10">
      {/* Left: Repo & Active Branch */}
      <div className="flex items-center gap-3">
        {currentRepo ? (
          <>
            <div className="flex items-center gap-1.5 hover:text-text transition-colors" title={currentRepo.local_path}>
              <FolderGit2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-semibold text-text">{currentRepo.name}</span>
            </div>

            {branches?.current && (
              <div className="flex items-center gap-1.5 pl-2 border-l border-surface0">
                <GitBranch className="w-3 h-3 text-blue shrink-0" />
                <span className="font-mono text-text">{branches.current}</span>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center gap-1.5 text-subtext0">
            <FolderGit2 className="w-3.5 h-3.5" />
            <span>No repository open</span>
          </div>
        )}
      </div>

      {/* Center: In-Memory Sandbox Status */}
      {currentRepo && (
        <div className="flex items-center gap-1.5">
          {conflictReport?.has_conflicts ? (
            <div className="flex items-center gap-1.5 text-red font-medium px-2 py-0.5 rounded bg-red/10 border border-red/20">
              <AlertTriangle className="w-3 h-3 text-red" />
              <span>Sandboxed: In-Memory Merge Conflicts Detected</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-green font-medium px-2 py-0.5 rounded bg-green/10 border border-green/20">
              <ShieldCheck className="w-3 h-3 text-green" />
              <span>Sandboxed</span>
            </div>
          )}
        </div>
      )}

      {/* Right: File Review Index, View Mode & Key Hints */}
      <div className="flex items-center gap-3">
        {totalFiles > 0 && (
          <div className="flex items-center gap-1 text-text">
            <span>File</span>
            <span className="font-mono font-semibold text-text">
              {currentFileIndex > 0 ? `${currentFileIndex} of ${totalFiles}` : `${totalFiles} total`}
            </span>
          </div>
        )}

        <div className="flex items-center gap-1 pl-2 border-l border-surface0 text-subtext1">
          {viewMode === 'split' ? (
            <Columns2 className="w-3 h-3 text-blue" />
          ) : (
            <Rows2 className="w-3 h-3 text-blue" />
          )}
          <span className="capitalize">{viewMode} View</span>
        </div>

        <div className="hidden lg:flex items-center gap-1.5 pl-2 border-l border-surface0 text-[10px] text-subtext0">
          <Keyboard className="w-3 h-3" />
          <span>[↑/↓] Files • [S/U] View</span>
        </div>
      </div>
    </footer>
  );
};
