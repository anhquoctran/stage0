import { useTranslation as useUiTextTranslation } from 'react-i18next';
import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle } from '../../../common/components/icons/AlertCircle';
import { GitBranch } from '../../../common/components/icons/GitBranch';
import { HardDrive } from '../../../common/components/icons/HardDrive';
import { Info } from '../../../common/components/icons/Info';
import { Package } from '../../../common/components/icons/Package';
import { RefreshCw } from '../../../common/components/icons/RefreshCw';
import { Terminal } from '../../../common/components/icons/Terminal';
import { useGitBinaryStore } from '../store/useGitBinaryStore';
import type { GitBinaryTabProps } from '../types/GitBinaryTabProps';
import { CustomGitBinaryForm } from './git-binary/CustomGitBinaryForm';
import { GitBinaryDetectionCard } from './git-binary/GitBinaryDetectionCard';
import { GitBinaryListTable } from './git-binary/GitBinaryListTable';
import { useCustomGitBinary } from './useCustomGitBinary';

export const GitBinaryTab: React.FC<GitBinaryTabProps> = ({
  draftBinaryId,
  draftBinaryPath,
  onSelectBinary,
  committedBinaryId,
  committedBinaryPath,
}) => {
  const { t: translateUiText } = useUiTextTranslation();
  const { binaries, isScanning, error, scanBinaries, validateCustomBinary, pickGitExecutable } =
    useGitBinaryStore();

  const {
    customBinaries,
    showAddCustom,
    setShowAddCustom,
    setCustomError,
    customPath,
    setCustomPath,
    handleBrowseCustom,
    handleValidateAndAddCustom,
    isValidatingCustom,
    customError,
  } = useCustomGitBinary({ pickGitExecutable, validateCustomBinary, onSelectBinary });

  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  // Scan on mount if list is empty
  useEffect(() => {
    if (binaries.length === 0 && !isScanning) {
      scanBinaries();
    }
  }, []);

  // Merge discovered binaries with any dynamically added custom binaries
  const allBinaries = useMemo(() => {
    const list = [...binaries];
    for (const cb of customBinaries) {
      if (!list.some((b) => b.path === cb.path)) {
        list.push(cb);
      }
    }
    return list;
  }, [binaries, customBinaries]);

  // Active binary item
  const committedBinary = useMemo(() => {
    return (
      allBinaries.find((b) => b.id === committedBinaryId || b.path === committedBinaryPath) ||
      allBinaries[0]
    );
  }, [allBinaries, committedBinaryId, committedBinaryPath]);

  // Selected draft item
  const selectedDraftBinary = useMemo(() => {
    return (
      allBinaries.find((b) => b.id === draftBinaryId || b.path === draftBinaryPath) ||
      committedBinary
    );
  }, [allBinaries, draftBinaryId, draftBinaryPath, committedBinary]);

  const isPendingRestart =
    draftBinaryId !== committedBinaryId || draftBinaryPath !== committedBinaryPath;

  const handleCopyPath = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(path);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 1800);
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'bundled':
        return <Package className="w-4 h-4 text-sapphire" />;
      case 'system':
        return <Terminal className="w-4 h-4 text-green" />;
      case 'custom':
        return <HardDrive className="w-4 h-4 text-peach" />;
      default:
        return <GitBranch className="w-4 h-4 text-lavender" />;
    }
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'bundled':
        return (
          <span className="text-[10px] font-medium px-2 py-0.5 bg-sapphire/15 text-sapphire border border-sapphire/30">
            Bundled
          </span>
        );
      case 'system':
        return (
          <span className="text-[10px] font-medium px-2 py-0.5 bg-green/15 text-green border border-green/30">
            System PATH
          </span>
        );
      case 'github_desktop':
        return (
          <span className="text-[10px] font-medium px-2 py-0.5 bg-mauve/15 text-mauve border border-mauve/30">
            GitHub Desktop
          </span>
        );
      case 'homebrew':
        return (
          <span className="text-[10px] font-medium px-2 py-0.5 bg-yellow/15 text-yellow border border-yellow/30">
            Homebrew
          </span>
        );
      case 'xcode':
        return (
          <span className="text-[10px] font-medium px-2 py-0.5 bg-blue/15 text-blue border border-blue/30">
            Xcode Tools
          </span>
        );
      case 'scoop':
        return (
          <span className="text-[10px] font-medium px-2 py-0.5 bg-teal/15 text-teal border border-teal/30">
            Scoop
          </span>
        );
      case 'custom':
        return (
          <span className="text-[10px] font-medium px-2 py-0.5 bg-peach/15 text-peach border border-peach/30">
            Custom
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-medium px-2 py-0.5 bg-surface2 text-subtext0 border border-surface1">
            Standard
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Section Header */}
      <div className="flex items-start justify-between pb-3 border-b border-surface0 gap-4 rounded-sm">
        <div>
          <h3 className="text-sm font-bold text-text flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-brand" />
            <span>Git Executable Binary</span>
          </h3>
          <p className="text-xs text-subtext0 mt-0.5 leading-relaxed">
            Choose between app-bundled Git or system-installed binaries for diffing, merge previews,
            and sandboxes. Exactly one binary is active at any time.
          </p>
        </div>

        <button
          type="button"
          onClick={() => scanBinaries()}
          disabled={isScanning}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-surface1 hover:bg-surface0 text-subtext0 hover:text-text text-xs transition-all cursor-pointer shrink-0 disabled:opacity-50 rounded-sm"
          title="Rescan system paths for available Git binaries"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-brand' : ''}`} />
          <span>{isScanning ? 'Scanning...' : 'Rescan System'}</span>
        </button>
      </div>

      {/* Restart Notice Banner if user changed selection */}
      {isPendingRestart && (
        <div className="p-3.5 bg-peach/10 border border-peach/30 flex items-start gap-3 rounded-sm">
          <Info className="w-4 h-4 text-peach shrink-0 mt-0.5" />
          <div className="text-xs">
            <div className="font-semibold text-text">Restart Required upon Applying</div>
            <div className="text-subtext0 mt-0.5 leading-relaxed">
              You selected{' '}
              <span className="font-mono text-text font-semibold">{selectedDraftBinary?.name}</span>
              . Clicking <span className="font-semibold text-text">Apply</span> or{' '}
              <span className="font-semibold text-text">{translateUiText('common.ok')}</span> will save this setting and prompt
              an application restart to switch all internal Git processes cleanly.
            </div>
          </div>
        </div>
      )}

      {/* Current Active Binary Info Card */}
      <GitBinaryDetectionCard
        committedBinary={committedBinary}
        getSourceBadge={getSourceBadge}
        handleCopyPath={handleCopyPath}
        copiedPath={copiedPath}
      />

      {/* Discovered Git Binaries List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-text">
            Available Git Executables ({allBinaries.length})
          </span>
          <span className="text-[11px] text-subtext0">Select one active binary</span>
        </div>

        {error && (
          <div className="p-3 bg-red/10 border border-red/30 text-red text-xs flex items-center gap-2 rounded-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isScanning && allBinaries.length === 0 ? (
          <div className="p-8 border border-dashed border-surface1 flex flex-col items-center justify-center text-center gap-2.5 rounded-sm">
            <RefreshCw className="w-5 h-5 text-brand animate-spin" />
            <div className="text-xs font-semibold text-text">Scanning for Git Binaries...</div>
            <div className="text-[11px] text-subtext0">
              Checking PATH, standard program directories, and bundled packages
            </div>
          </div>
        ) : allBinaries.length === 0 ? (
          <div className="p-6 border border-dashed border-surface1 text-center text-xs text-subtext0 rounded-sm">
            No Git binaries found on your system. You can manually specify a custom path below.
          </div>
        ) : (
          <GitBinaryListTable
            allBinaries={allBinaries}
            draftBinaryId={draftBinaryId}
            draftBinaryPath={draftBinaryPath}
            committedBinaryId={committedBinaryId}
            committedBinaryPath={committedBinaryPath}
            onSelectBinary={onSelectBinary}
            getSourceIcon={getSourceIcon}
            getSourceBadge={getSourceBadge}
            handleCopyPath={handleCopyPath}
            copiedPath={copiedPath}
          />
        )}
      </div>

      {/* Add Custom Git Executable Section */}
      <CustomGitBinaryForm
        showAddCustom={showAddCustom}
        setShowAddCustom={setShowAddCustom}
        setCustomError={setCustomError}
        customPath={customPath}
        setCustomPath={setCustomPath}
        navigator={navigator}
        handleBrowseCustom={handleBrowseCustom}
        handleValidateAndAddCustom={handleValidateAndAddCustom}
        isValidatingCustom={isValidatingCustom}
        customError={customError}
      />
    </div>
  );
};
