import React, { useState, useEffect, useMemo } from 'react';
import {
  GitBranch,
  RefreshCw,
  Check,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  Copy,
  Terminal,
  Package,
  HardDrive,
  Info,
  ShieldCheck,
  Plus,
  Play,
  ExternalLink,
} from 'lucide-react';
import { useGitBinaryStore } from '../../store/useGitBinaryStore';
import { GitBinaryInfo } from '../../types/gitBinary';

interface GitBinaryTabProps {
  draftBinaryId: string;
  draftBinaryPath: string;
  onSelectBinary: (id: string, path: string) => void;
  committedBinaryId: string;
  committedBinaryPath: string;
}

export const GitBinaryTab: React.FC<GitBinaryTabProps> = ({
  draftBinaryId,
  draftBinaryPath,
  onSelectBinary,
  committedBinaryId,
  committedBinaryPath,
}) => {
  const {
    binaries,
    isScanning,
    isLoading,
    error,
    scanBinaries,
    validateCustomBinary,
    pickGitExecutable,
    clearError,
  } = useGitBinaryStore();

  const [customPath, setCustomPath] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);
  const [isValidatingCustom, setIsValidatingCustom] = useState(false);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customBinaries, setCustomBinaries] = useState<GitBinaryInfo[]>([]);

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
    return allBinaries.find((b) => b.id === committedBinaryId || b.path === committedBinaryPath) || allBinaries[0];
  }, [allBinaries, committedBinaryId, committedBinaryPath]);

  // Selected draft item
  const selectedDraftBinary = useMemo(() => {
    return allBinaries.find((b) => b.id === draftBinaryId || b.path === draftBinaryPath) || committedBinary;
  }, [allBinaries, draftBinaryId, draftBinaryPath, committedBinary]);

  const isPendingRestart = draftBinaryId !== committedBinaryId || draftBinaryPath !== committedBinaryPath;

  const handleCopyPath = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(path);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 1800);
  };

  const handleBrowseCustom = async () => {
    setCustomError(null);
    const picked = await pickGitExecutable();
    if (picked) {
      setCustomPath(picked);
    }
  };

  const handleValidateAndAddCustom = async () => {
    if (!customPath.trim()) {
      setCustomError('Please specify the path to a Git executable');
      return;
    }
    setIsValidatingCustom(true);
    setCustomError(null);
    try {
      const validated = await validateCustomBinary(customPath.trim());
      setCustomBinaries((prev) => [validated, ...prev]);
      onSelectBinary(validated.id, validated.path);
      setCustomPath('');
      setShowAddCustom(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setCustomError(msg);
    } finally {
      setIsValidatingCustom(false);
    }
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
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-sapphire/15 text-sapphire border border-sapphire/30">
            Bundled
          </span>
        );
      case 'system':
        return (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green/15 text-green border border-green/30">
            System PATH
          </span>
        );
      case 'github_desktop':
        return (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-mauve/15 text-mauve border border-mauve/30">
            GitHub Desktop
          </span>
        );
      case 'homebrew':
        return (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-yellow/15 text-yellow border border-yellow/30">
            Homebrew
          </span>
        );
      case 'xcode':
        return (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue/15 text-blue border border-blue/30">
            Xcode Tools
          </span>
        );
      case 'scoop':
        return (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-teal/15 text-teal border border-teal/30">
            Scoop
          </span>
        );
      case 'custom':
        return (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-peach/15 text-peach border border-peach/30">
            Custom
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface2 text-subtext0 border border-surface1">
            Standard
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Section Header */}
      <div className="flex items-start justify-between pb-3 border-b border-surface0 gap-4">
        <div>
          <h3 className="text-sm font-bold text-text flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-brand" />
            <span>Git Executable Binary</span>
          </h3>
          <p className="text-xs text-subtext0 mt-0.5 leading-relaxed">
            Choose between app-bundled Git or system-installed binaries for diffing, merge previews, and sandboxes. Exactly one binary is active at any time.
          </p>
        </div>

        <button
          type="button"
          onClick={() => scanBinaries()}
          disabled={isScanning}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface1 hover:bg-surface0 text-subtext0 hover:text-text text-xs transition-all cursor-pointer shrink-0 disabled:opacity-50"
          title="Rescan system paths for available Git binaries"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-brand' : ''}`} />
          <span>{isScanning ? 'Scanning...' : 'Rescan System'}</span>
        </button>
      </div>

      {/* Restart Notice Banner if user changed selection */}
      {isPendingRestart && (
        <div className="p-3.5 rounded-xl bg-peach/10 border border-peach/30 flex items-start gap-3">
          <Info className="w-4 h-4 text-peach shrink-0 mt-0.5" />
          <div className="text-xs">
            <div className="font-semibold text-text">
              Restart Required upon Applying
            </div>
            <div className="text-subtext0 mt-0.5 leading-relaxed">
              You selected <span className="font-mono text-text font-semibold">{selectedDraftBinary?.name}</span>. Clicking <span className="font-semibold text-text">Apply</span> or <span className="font-semibold text-text">OK</span> will save this setting and prompt an application restart to switch all internal Git processes cleanly.
            </div>
          </div>
        </div>
      )}

      {/* Current Active Binary Info Card */}
      <div className="p-4 rounded-xl bg-surface0/60 border border-surface1 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-subtext0 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-green" />
            Currently Active in Process
          </span>
          {committedBinary && getSourceBadge(committedBinary.source)}
        </div>
        {committedBinary ? (
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-text flex items-center gap-2">
                <span>{committedBinary.name}</span>
                <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-surface1 text-text border border-surface2">
                  {committedBinary.version || 'unknown version'}
                </span>
              </div>
              <div className="font-mono text-[11px] text-subtext0 truncate mt-1">
                {committedBinary.path}
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => handleCopyPath(committedBinary.path, e)}
              className="p-1.5 rounded-lg hover:bg-surface1 text-subtext0 hover:text-text transition-colors cursor-pointer shrink-0"
              title="Copy active Git binary path"
            >
              {copiedPath === committedBinary.path ? (
                <Check className="w-3.5 h-3.5 text-green" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        ) : (
          <div className="text-xs text-subtext0">
            System Default (PATH: git)
          </div>
        )}
      </div>

      {/* Discovered Git Binaries List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-text">
            Available Git Executables ({allBinaries.length})
          </span>
          <span className="text-[11px] text-subtext0">
            Select one active binary
          </span>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red/10 border border-red/30 text-red text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isScanning && allBinaries.length === 0 ? (
          <div className="p-8 rounded-xl border border-dashed border-surface1 flex flex-col items-center justify-center text-center gap-2.5">
            <RefreshCw className="w-5 h-5 text-brand animate-spin" />
            <div className="text-xs font-semibold text-text">Scanning for Git Binaries...</div>
            <div className="text-[11px] text-subtext0">
              Checking PATH, standard program directories, and bundled packages
            </div>
          </div>
        ) : allBinaries.length === 0 ? (
          <div className="p-6 rounded-xl border border-dashed border-surface1 text-center text-xs text-subtext0">
            No Git binaries found on your system. You can manually specify a custom path below.
          </div>
        ) : (
          <div className="space-y-2">
            {allBinaries.map((binary) => {
              const isSelected = binary.id === draftBinaryId || binary.path === draftBinaryPath;
              const isCurrentlyActive = binary.id === committedBinaryId || binary.path === committedBinaryPath;

              return (
                <div
                  key={binary.id}
                  onClick={() => onSelectBinary(binary.id, binary.path)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-brand/10 border-brand shadow-xs'
                      : 'bg-surface0/40 border-surface0 hover:bg-surface0/80 hover:border-surface1'
                  }`}
                >
                  {/* Left: Radio + Icon + Info */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {/* Radio Button Circle */}
                    <div className="pt-0.5 shrink-0">
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                          isSelected
                            ? 'border-brand bg-brand text-[#11111b]'
                            : 'border-surface2 bg-transparent hover:border-subtext0'
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[#11111b]" />}
                      </div>
                    </div>

                    {/* Source Icon */}
                    <div className="pt-0.5 shrink-0">
                      {getSourceIcon(binary.source)}
                    </div>

                    {/* Text Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-semibold ${isSelected ? 'text-text font-bold' : 'text-text'}`}>
                          {binary.name}
                        </span>
                        {getSourceBadge(binary.source)}
                        {isCurrentlyActive && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-green/15 text-green border border-green/30">
                            Active
                          </span>
                        )}
                        {isSelected && !isCurrentlyActive && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-peach/15 text-peach border border-peach/30">
                            Selected
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-surface1 text-text border border-surface2 shrink-0">
                          {binary.version || 'Version unknown'}
                        </span>
                        <span className="font-mono text-[11px] text-subtext0 truncate">
                          {binary.path}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Copy Path Action */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleCopyPath(binary.path, e)}
                      className="p-1.5 rounded-lg hover:bg-surface1 text-subtext0 hover:text-text transition-colors cursor-pointer"
                      title="Copy binary path to clipboard"
                    >
                      {copiedPath === binary.path ? (
                        <Check className="w-3.5 h-3.5 text-green" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Custom Git Executable Section */}
      <div className="pt-2 border-t border-surface0/60">
        {!showAddCustom ? (
          <button
            type="button"
            onClick={() => setShowAddCustom(true)}
            className="flex items-center gap-1.5 text-xs text-brand hover:underline font-medium cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Custom Git Binary Path...</span>
          </button>
        ) : (
          <div className="p-4 rounded-xl bg-surface0/40 border border-surface1 space-y-3 animate-in fade-in duration-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-text">
                Specify Custom Git Executable
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowAddCustom(false);
                  setCustomError(null);
                }}
                className="text-[11px] text-subtext0 hover:text-text cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                placeholder={
                  typeof navigator !== 'undefined' && navigator.userAgent.includes('Win')
                    ? 'C:\\Path\\To\\git.exe'
                    : '/usr/local/bin/git'
                }
                className="flex-1 px-3 py-1.5 text-xs font-mono bg-base border border-surface1 rounded-lg text-text focus:outline-none focus:border-brand placeholder:text-subtext0/50"
              />
              <button
                type="button"
                onClick={handleBrowseCustom}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-surface1 hover:bg-surface1 text-xs text-subtext0 hover:text-text transition-colors cursor-pointer shrink-0"
                title="Browse for executable file"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Browse...</span>
              </button>
              <button
                type="button"
                onClick={handleValidateAndAddCustom}
                disabled={isValidatingCustom || !customPath.trim()}
                className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-brand text-[#11111b] text-xs font-semibold hover:bg-brand/90 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
              >
                {isValidatingCustom ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Test &amp; Select</span>
              </button>
            </div>

            {customError && (
              <div className="p-2.5 rounded-lg bg-red/10 border border-red/30 text-red text-xs flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{customError}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
