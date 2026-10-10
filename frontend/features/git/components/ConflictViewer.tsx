import React, { useState } from 'react';
import { AlertTriangle } from '../../../common/components/icons/AlertTriangle';
import { ShieldAlert } from '../../../common/components/icons/ShieldAlert';
import { Code2 } from '../../../common/components/icons/Code2';
import { FolderOpen } from '../../../common/components/icons/FolderOpen';
import { Copy } from '../../../common/components/icons/Copy';
import { Check } from '../../../common/components/icons/Check';
import { ChevronLeft } from '../../../common/components/icons/ChevronLeft';
import { ChevronRight } from '../../../common/components/icons/ChevronRight';
import { Columns2 } from '../../../common/components/icons/Columns2';
import { FileCode } from '../../../common/components/icons/FileCode';
import { RotateCw } from '../../../common/components/icons/RotateCw';
import { GitMerge } from '../../../common/components/icons/GitMerge';
import { useGitStore } from '../store/useGitStore';
import { usePreferencesStore } from '../../preferences/store/usePreferencesStore';
import { openFileInEditor, revealInOs, getOsFileManagerName } from '../utils/fileActions';
import { formatShortcutText } from '../../../common/utils/shortcuts';
import type { ConflictViewerProps } from '../types/ConflictViewerProps';

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

  const {
    fontFamily,
    fontSize,
    lineSpacing,
    enableLigatures,
  } = usePreferencesStore();

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
      <div className="bg-gradient-to-r from-red/15 via-red/10 to-red/5 border-b border-red/30 px-4 py-3 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2 bg-red/20 text-red rounded-lg border border-red/40 shrink-0 mt-0.5">
              <ShieldAlert className="w-5 h-5 text-red" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-red">
                  Conflict Inspection
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-red/25 text-red font-mono font-bold border border-red/40">
                  {regions.length > 0
                    ? `${regions.length} conflict block${regions.length > 1 ? 's' : ''}`
                    : activeConflictPreview?.conflict_type || 'Unmerged conflict'}
                </span>
              </div>
              <p className="text-xs text-subtext1 mt-1 font-mono truncate">
                <span className="text-text font-bold">{selectedFile.path}</span>
                <span className="mx-2 text-subtext0">•</span>
                <span>Collision between</span>
                <code className="text-blue font-semibold ml-1 mr-1">{baseBranch}</code>
                <span>and</span>
                <code className="text-blue font-semibold ml-1">{compareBranch}</code>
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {currentRepo && (
              <button
                type="button"
                onClick={handleOpenInVsCode}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface0 hover:bg-surface1 border border-surface1 text-text text-xs font-medium transition-colors cursor-pointer"
                title="Open this file directly in Visual Studio Code"
              >
                <Code2 className="w-3.5 h-3.5 text-subtext0" />
                <span>Resolve in VS Code</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleRevealInOs}
              className="p-1.5 rounded-md bg-surface0 hover:bg-surface1 border border-surface1 text-subtext0 hover:text-text transition-colors cursor-pointer"
              title={`Reveal in ${fileManagerName}`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => {
                fetchConflictPreview();
                refreshDiff();
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-surface0 hover:bg-surface1 border border-surface1 text-text text-xs font-medium transition-colors cursor-pointer"
              title={formatShortcutText('Refresh virtual conflict analysis (Ctrl+R)')}
            >
              <RotateCw className="w-3.5 h-3.5 text-subtext0" />
              <span>Re-check</span>
            </button>

            {onSwitchToDiff && (
              <button
                type="button"
                onClick={onSwitchToDiff}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface1 hover:bg-surface2 text-text text-xs font-medium transition-colors cursor-pointer"
                title="Switch back to regular Diff View"
              >
                <FileCode className="w-3.5 h-3.5 text-blue" />
                <span>View Diff</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sub-bar: Display Mode Switcher & Block Stepper */}
      <div className="h-10 bg-mantle border-b border-surface0 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          {/* Display Mode Switcher */}
          <div className="flex items-center bg-surface0 rounded-md p-0.5 border border-surface0">
            <button
              type="button"
              onClick={() => setDisplayMode('blocks')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
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
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
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
          <div className="flex items-center gap-1 bg-surface0 rounded border border-surface0 px-1 py-0.5">
            <button
              type="button"
              disabled={activeRegionIndex === 0}
              onClick={() => setActiveRegionIndex((prev) => Math.max(0, prev - 1))}
              className="p-1 text-subtext1 hover:text-text rounded hover:bg-surface1 transition-colors disabled:opacity-30 cursor-pointer"
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
              className="p-1 text-subtext1 hover:text-text rounded hover:bg-surface1 transition-colors disabled:opacity-30 cursor-pointer"
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
            <div className="w-6 h-6 border-2 border-red border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-medium">Computing 3-way in-memory collision...</p>
          </div>
        ) : conflictPreviewError ? (
          <div className="p-6 bg-red/10 border border-red/30 rounded-lg text-xs text-red space-y-2">
            <p className="font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              Failed to load conflict preview
            </p>
            <p className="font-mono text-[11px] opacity-90">{conflictPreviewError}</p>
          </div>
        ) : regions.length > 0 && displayMode === 'blocks' ? (
          /* Side-by-Side Conflicting Blocks View */
          <div className="space-y-6 max-w-6xl mx-auto">
            {regions.map((region, idx) => (
              <div
                key={`conflict-block-${region.start_line}-${region.end_line}`}
                className="border border-red/40 rounded-xl overflow-hidden shadow-md bg-mantle"
              >
                {/* Block Header Banner */}
                <div className="bg-red/15 border-b border-red/30 px-3.5 py-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-red text-white text-[10px] font-bold uppercase tracking-wider">
                      Conflict Block #{idx + 1}
                    </span>
                    <span className="text-xs font-mono text-text font-semibold">
                      Lines {region.start_line} – {region.end_line}
                    </span>
                  </div>

                  <span className="text-[11px] text-subtext1">
                    Conflicting changes on target branch vs source branch
                  </span>
                </div>

                {/* 2-Column Side-by-Side Comparison */}
                <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-surface0">
                  {/* Left Column: Target Branch (Base) */}
                  <div className="flex flex-col min-w-0 bg-red/5">
                    <div className="bg-surface0/90 border-b border-surface0 px-3 py-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-red shrink-0" />
                        <span className="text-xs font-bold text-red uppercase tracking-wider">
                          Current / Target
                        </span>
                        <code className="text-[11px] font-mono text-text bg-surface1 px-1.5 py-0.5 rounded truncate max-w-[200px]">
                          {baseBranch}
                        </code>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopy(region.base_code, `base-${idx}`)}
                        className="p-1 rounded text-subtext0 hover:text-text hover:bg-surface1 transition-colors cursor-pointer"
                        title="Copy target branch code"
                      >
                        {copiedKey === `base-${idx}` ? (
                          <Check className="w-3.5 h-3.5 text-green" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    <pre
                      style={{
                        fontFamily: fontFamily || 'inherit',
                        fontSize: fontSize ? `${fontSize}px` : '13px',
                        lineHeight: lineSpacing || 1.5,
                        fontVariantLigatures: enableLigatures ? 'normal' : 'none',
                      }}
                      className="p-3 text-xs overflow-x-auto font-mono text-text whitespace-pre flex-1"
                    >
                      {region.base_code || <em className="text-subtext0 italic">(Empty on {baseBranch})</em>}
                    </pre>
                  </div>

                  {/* Right Column: Source Branch (Compare) */}
                  <div className="flex flex-col min-w-0 bg-blue/5">
                    <div className="bg-surface0/90 border-b border-surface0 px-3 py-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-blue shrink-0" />
                        <span className="text-xs font-bold text-blue uppercase tracking-wider">
                          Incoming / Source
                        </span>
                        <code className="text-[11px] font-mono text-text bg-surface1 px-1.5 py-0.5 rounded truncate max-w-[200px]">
                          {compareBranch}
                        </code>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopy(region.compare_code, `compare-${idx}`)}
                        className="p-1 rounded text-subtext0 hover:text-text hover:bg-surface1 transition-colors cursor-pointer"
                        title="Copy incoming branch code"
                      >
                        {copiedKey === `compare-${idx}` ? (
                          <Check className="w-3.5 h-3.5 text-green" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    <pre
                      style={{
                        fontFamily: fontFamily || 'inherit',
                        fontSize: fontSize ? `${fontSize}px` : '13px',
                        lineHeight: lineSpacing || 1.5,
                        fontVariantLigatures: enableLigatures ? 'normal' : 'none',
                      }}
                      className="p-3 text-xs overflow-x-auto font-mono text-text whitespace-pre flex-1"
                    >
                      {region.compare_code || <em className="text-subtext0 italic">(Empty on {compareBranch})</em>}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Full File View with Decorated Conflict Markers */
          <div className="max-w-6xl mx-auto border border-surface0 rounded-xl overflow-hidden bg-mantle shadow-sm">
            <div className="bg-surface0 px-3.5 py-2 border-b border-surface1 flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-text">
                In-Memory 3-Way Merged File: {selectedFile.path}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(activeConflictPreview?.merged_content || '', 'full')}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-surface1 hover:bg-surface2 text-xs text-text transition-colors cursor-pointer"
                title="Copy entire merged file with markers"
              >
                {copiedKey === 'full' ? (
                  <Check className="w-3 h-3 text-green" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span>Copy Full File</span>
              </button>
            </div>

            <div
              style={{
                fontFamily: fontFamily || 'inherit',
                fontSize: fontSize ? `${fontSize}px` : '13px',
                lineHeight: lineSpacing || 1.5,
                fontVariantLigatures: enableLigatures ? 'normal' : 'none',
              }}
              className="p-3 font-mono text-xs overflow-x-auto divide-y divide-transparent"
            >
              {(activeConflictPreview?.merged_content || '').split('\n').map((line, idx) => {
                const isStart = line.startsWith('<<<<<<<');
                const isMid = line.startsWith('=======');
                const isEnd = line.startsWith('>>>>>>>');

                if (isStart) {
                  return (
                    <div
                      key={idx}
                      className="bg-red/25 text-red font-bold px-2 py-1 my-1 rounded border-l-4 border-red flex items-center gap-2"
                    >
                      <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-red text-white">
                        Target Change
                      </span>
                      <span>{line}</span>
                    </div>
                  );
                }

                if (isMid) {
                  return (
                    <div
                      key={idx}
                      className="bg-surface1 text-subtext1 font-bold px-2 py-0.5 my-1 border-y border-dashed border-surface2 flex items-center gap-2 text-center justify-center text-[11px]"
                    >
                      <span>─── COLLISION BOUNDARY ───</span>
                    </div>
                  );
                }

                if (isEnd) {
                  return (
                    <div
                      key={idx}
                      className="bg-blue/25 text-blue font-bold px-2 py-1 my-1 rounded border-l-4 border-blue flex items-center gap-2"
                    >
                      <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-blue text-white">
                        Incoming Change
                      </span>
                      <span>{line}</span>
                    </div>
                  );
                }

                return (
                  <div key={idx} className="flex hover:bg-surface0/60 px-1 py-0.5">
                    <span className="w-12 text-subtext0 select-none text-right pr-3 shrink-0 text-[11px]">
                      {idx + 1}
                    </span>
                    <span className="text-text whitespace-pre flex-1">{line}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
