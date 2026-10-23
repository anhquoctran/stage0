import React, { useState } from 'react';
import { AlertTriangle } from '../../../common/components/icons/AlertTriangle';
import { ChevronLeft } from '../../../common/components/icons/ChevronLeft';
import { ChevronRight } from '../../../common/components/icons/ChevronRight';
import { Columns2 } from '../../../common/components/icons/Columns2';
import { GitMerge } from '../../../common/components/icons/GitMerge';
import { usePreferencesStore } from '../../preferences/store/usePreferencesStore';
import { useGitStore } from '../store/useGitStore';
import type { ConflictViewerProps } from '../types/ConflictViewerProps';
import { getOsFileManagerName, openFileInEditor, revealInOs } from '../utils/fileActions';
import { ConflictBlocksView } from './conflict/ConflictBlocksView';
import { ConflictMarkedFileView } from './conflict/ConflictMarkedFileView';
import { ConflictResolutionBar } from './conflict/ConflictResolutionBar';

export const ConflictViewer: React.FC<ConflictViewerProps> = ({ onSwitchToDiff }) => {
  const {
    currentRepo,
    selectedFile,
    baseBranch,
    compareBranch,
    activeConflictPreview,
    isConflictLoading,
    conflictPreviewError,
    refreshDiff,
    fetchConflictPreview,
    showToast,
  } = useGitStore();

  const { fontFamily, fontSize, lineSpacing, enableLigatures } = usePreferencesStore();

  const [displayMode, setDisplayMode] = useState<'blocks' | 'file'>('blocks');
  const [activeRegionIndex, setActiveRegionIndex] = useState(0);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!selectedFile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-subtext1">
        <AlertTriangle className="w-8 h-8 text-amber-400 mb-2" />
        <p className="font-semibold text-text text-sm">No file selected</p>
        <span className="text-xs text-subtext0">Select a file from the sidebar</span>
      </div>
    );
  }

  const fileManagerName = getOsFileManagerName();
  const regions = activeConflictPreview?.conflict_regions || [];

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast('Copied code block to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleOpenInVsCode = async () => {
    if (!currentRepo) return;
    try {
      await openFileInEditor(currentRepo.local_path, selectedFile.path);
      showToast(`Opened ${selectedFile.path} in VS Code`);
    } catch (err) {
      showToast(`Failed to open in VS Code: ${err}`);
    }
  };

  const handleRevealInOs = async () => {
    if (!currentRepo) return;
    try {
      await revealInOs(currentRepo.local_path, selectedFile.path);
      showToast(`Revealed file in ${fileManagerName}`);
    } catch (err) {
      showToast(`Failed to reveal file: ${err}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-base overflow-hidden select-none">
      {/* Top Conflict Status Header */}
      <ConflictResolutionBar
        regions={regions}
        activeConflictPreview={activeConflictPreview}
        selectedFile={selectedFile}
        baseBranch={baseBranch}
        compareBranch={compareBranch}
        currentRepo={currentRepo}
        handleOpenInVsCode={handleOpenInVsCode}
        handleRevealInOs={handleRevealInOs}
        fileManagerName={fileManagerName}
        fetchConflictPreview={fetchConflictPreview}
        refreshDiff={refreshDiff}
        onSwitchToDiff={onSwitchToDiff}
      />

      {/* Sub-bar: Display Mode Switcher & Block Stepper */}
      <div className="h-10 bg-mantle border-b border-surface0 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          {/* Display Mode Switcher */}
          <div className="flex items-center bg-surface0  p-0.5 border border-surface0">
            <button
              type="button"
              onClick={() => setDisplayMode('blocks')}
              className={`flex items-center gap-1.5 px-2.5 py-1  text-xs font-semibold transition-colors cursor-pointer ${
                displayMode === 'blocks'
                  ? 'bg-surface2 text-text shadow-xs'
                  : 'text-subtext1 hover:text-text'
              }`}
              title="Compare conflicting blocks side-by-side"
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span>Compare Blocks ({regions.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setDisplayMode('file')}
              className={`flex items-center gap-1.5 px-2.5 py-1  text-xs font-semibold transition-colors cursor-pointer ${
                displayMode === 'file'
                  ? 'bg-surface2 text-text shadow-xs'
                  : 'text-subtext1 hover:text-text'
              }`}
              title="Inspect full file with in-memory conflict markers"
            >
              <GitMerge className="w-3.5 h-3.5" />
              <span>Full File Markers</span>
            </button>
          </div>

          <span className="text-[11px] text-subtext0 ml-2 hidden sm:inline">
            Stage0 Virtual 3-Way Collision Inspector
          </span>
        </div>

        {/* Region Stepper (when multiple conflict blocks exist) */}
        {regions.length > 1 && displayMode === 'blocks' && (
          <div className="flex items-center gap-1 bg-surface0  border border-surface0 px-1 py-0.5">
            <button
              type="button"
              disabled={activeRegionIndex === 0}
              onClick={() => setActiveRegionIndex((prev) => Math.max(0, prev - 1))}
              className="p-1 text-subtext1 hover:text-text  hover:bg-surface1 transition-colors disabled:opacity-30 cursor-pointer"
              title="Previous conflict block"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] text-subtext1 font-mono px-1.5">
              Block {activeRegionIndex + 1} of {regions.length}
            </span>
            <button
              type="button"
              disabled={activeRegionIndex === regions.length - 1}
              onClick={() => setActiveRegionIndex((prev) => Math.min(regions.length - 1, prev + 1))}
              className="p-1 text-subtext1 hover:text-text  hover:bg-surface1 transition-colors disabled:opacity-30 cursor-pointer"
              title="Next conflict block"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-4 bg-base">
        {isConflictLoading ? (
          <div className="flex flex-col items-center justify-center h-64 text-subtext1 space-y-3">
            <div className="w-6 h-6 border-2 border-red border-t-transparent  animate-spin" />
            <p className="text-xs font-medium">Computing 3-way in-memory collision...</p>
          </div>
        ) : conflictPreviewError ? (
          <div className="p-6 bg-red/10 border border-red/30  text-xs text-red space-y-2">
            <p className="font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              Failed to load conflict preview
            </p>
            <p className="font-mono text-[11px] opacity-90">{conflictPreviewError}</p>
          </div>
        ) : regions.length > 0 && displayMode === 'blocks' ? (
          /* Side-by-Side Conflicting Blocks View */
          <ConflictBlocksView
            regions={regions}
            baseBranch={baseBranch}
            handleCopy={handleCopy}
            copiedKey={copiedKey}
            fontFamily={fontFamily}
            fontSize={fontSize}
            lineSpacing={lineSpacing}
            enableLigatures={enableLigatures}
            compareBranch={compareBranch}
          />
        ) : (
          /* Full File View with Decorated Conflict Markers */
          <ConflictMarkedFileView
            selectedFile={selectedFile}
            handleCopy={handleCopy}
            activeConflictPreview={activeConflictPreview}
            copiedKey={copiedKey}
            fontFamily={fontFamily}
            fontSize={fontSize}
            lineSpacing={lineSpacing}
            enableLigatures={enableLigatures}
          />
        )}
      </div>
    </div>
  );
};
