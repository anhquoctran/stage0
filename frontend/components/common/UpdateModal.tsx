import React, { useEffect } from 'react';
import { useUpdateStore } from '../../store/useUpdateStore';
import { SOFTWARE_ABOUT } from '../../config/about';
import {
  DownloadCloud,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Loader2,
  X,
  Sparkles,
  Clock,
} from './icons';
import { MockScenario } from '../../types/update';

export const UpdateModal: React.FC = () => {
  const {
    status,
    isModalOpen,
    updatePayload,
    downloadProgress,
    downloadSpeed,
    downloadedText,
    errorMessage,
    mockScenario,
    lastCheckedTime,
    setMockScenario,
    closeModal,
    checkForUpdates,
    startDownload,
    cancelDownload,
    applyUpdateAndRestart,
  } = useUpdateStore();

  useEffect(() => {
    if (!isModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (status !== 'downloading') {
          closeModal();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, status, closeModal]);

  if (!isModalOpen) return null;

  const currentVersion = SOFTWARE_ABOUT.packageVersion || '0.1.0';
  const osName = (SOFTWARE_ABOUT.os || 'windows').toLowerCase();
  const archName = (SOFTWARE_ABOUT.arch || 'amd64').toLowerCase();

  const handleScenarioChange = (scenario: MockScenario) => {
    setMockScenario(scenario);
    void checkForUpdates(false);
  };

  return (
    <div
      className="fixed inset-0 z-60 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-100"
      onClick={() => status !== 'downloading' && closeModal()}
    >
      <div
        className="relative bg-mantle border border-surface0 max-w-xl w-full shadow-2xl animate-in zoom-in-95 duration-150 text-text cursor-default rounded-none overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          data-tauri-drag-region
          className="flex items-center justify-between px-5 py-3.5 border-b border-surface0 cursor-default"
        >
          <div data-tauri-drag-region className="flex items-center gap-2 pointer-events-none">
            <DownloadCloud className="w-4 h-4 text-brand" />
            <h3 className="text-sm font-bold text-text tracking-tight">Software Update</h3>
          </div>
          {status !== 'downloading' && (
            <button
              type="button"
              onClick={closeModal}
              className="p-1 text-subtext0 hover:text-text hover:bg-surface0 transition-colors cursor-pointer rounded-none"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content Body based on Status */}
        <div className="p-6">
          {/* 1. CHECKING STATUS */}
          {status === 'checking' && (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
              <Loader2 className="w-9 h-9 text-brand animate-spin" />
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-text">Checking for Updates...</h4>
                <p className="text-xs text-subtext0">
                  Querying version management API for {osName} ({archName})
                </p>
              </div>
              <div className="bg-surface0/40 border border-surface0 px-3 py-1 text-[11px] font-mono text-subtext1">
                current_version={currentVersion}&amp;os_name={osName}&amp;arch_name={archName}
              </div>
            </div>
          )}

          {/* 2. UP TO DATE STATUS */}
          {status === 'up-to-date' && (
            <div className="flex flex-col items-center justify-center py-5 text-center space-y-3.5">
              <div className="w-12 h-12 bg-green/10 border border-green/30 flex items-center justify-center text-green">
                <CheckCircle2 className="w-6 h-6 text-green" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-text">You're Up to Date!</h4>
                <p className="text-xs text-subtext1 max-w-sm leading-relaxed">
                  Stage0 <span className="font-mono text-text font-semibold">v{currentVersion}</span> is currently the latest version for{' '}
                  <span className="capitalize">{osName}</span> ({archName}).
                </p>
              </div>
              {lastCheckedTime && (
                <div className="flex items-center gap-1.5 text-[11px] text-subtext0">
                  <Clock className="w-3 h-3" />
                  <span>Last checked at {lastCheckedTime}</span>
                </div>
              )}
            </div>
          )}

          {/* 3. UPDATE AVAILABLE STATUS */}
          {status === 'available' && updatePayload && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-blue/15 text-blue border border-blue/30 text-[10px] font-mono font-semibold uppercase">
                      New Release
                    </span>
                    <h4 className="text-base font-bold text-text">
                      Stage0 v{updatePayload.latestVersion}
                    </h4>
                  </div>
                  <p className="text-xs text-subtext0">
                    Released on {updatePayload.releaseDate} • {updatePayload.fileSize || '48.6 MB'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] text-subtext0 uppercase font-mono block">Current</span>
                  <span className="text-xs font-mono text-subtext1">v{currentVersion}</span>
                </div>
              </div>

              {/* Release Notes */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-text">
                  <Sparkles className="w-3.5 h-3.5 text-brand" />
                  <span>What's New in this Version:</span>
                </div>
                <div className="bg-surface0/30 border border-surface0 p-3 max-h-40 overflow-y-auto text-xs text-subtext1 font-sans leading-relaxed whitespace-pre-line select-text">
                  {updatePayload.releaseNotes || 'No release notes provided.'}
                </div>
              </div>
            </div>
          )}

          {/* 4. DOWNLOADING STATUS */}
          {status === 'downloading' && (
            <div className="py-4 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-text">Downloading Stage0 v{updatePayload?.latestVersion}...</span>
                <span className="font-mono text-blue font-bold">{downloadProgress}%</span>
              </div>

              {/* Progress Bar Container */}
              <div className="w-full bg-surface0 border border-surface1/60 h-2.5 overflow-hidden">
                <div
                  className="bg-blue h-full transition-all duration-200 ease-out"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-subtext0 font-mono">
                <span>{downloadedText}</span>
                <span>{downloadSpeed}</span>
              </div>

              <p className="text-[11px] text-subtext0 leading-relaxed">
                Please wait while the update binary package is safely retrieved. Do not exit Stage0.
              </p>
            </div>
          )}

          {/* 5. READY TO INSTALL STATUS */}
          {status === 'ready' && (
            <div className="py-4 space-y-4 text-center">
              <div className="w-12 h-12 bg-green/10 border border-green/30 flex items-center justify-center text-green mx-auto">
                <CheckCircle2 className="w-6 h-6 text-green" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-text">Update Ready to Install</h4>
                <p className="text-xs text-subtext1 max-w-md mx-auto leading-relaxed">
                  Stage0 has finished downloading version <span className="font-mono text-text font-semibold">v{updatePayload?.latestVersion}</span>.
                  Would you like to close Stage0 and restart now with the new version?
                </p>
              </div>
            </div>
          )}

          {/* 6. ERROR STATUS */}
          {status === 'error' && (
            <div className="flex flex-col items-center justify-center py-4 text-center space-y-3">
              <div className="w-12 h-12 bg-red/10 border border-red/30 flex items-center justify-center text-red">
                <AlertTriangle className="w-6 h-6 text-red" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-text">Update Check Failed</h4>
                <p className="text-xs text-red/90 max-w-sm leading-relaxed">
                  {errorMessage || 'An error occurred while connecting to the version management server.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-surface0 flex items-center justify-between bg-surface0/10">
          {/* Left Side: Mock Scenario Tester Switcher */}
          <div className="flex items-center gap-2 text-[11px] text-subtext0">
            <span className="font-mono text-[10px] text-subtext0 uppercase">Mock API:</span>
            <button
              type="button"
              onClick={() => handleScenarioChange('available')}
              className={`px-2 py-0.5 text-[10px] font-mono border transition-colors cursor-pointer rounded-none ${
                mockScenario === 'available'
                  ? 'bg-blue/15 text-blue border-blue/40 font-semibold'
                  : 'bg-surface0 text-subtext0 border-surface1 hover:text-text'
              }`}
              title="Simulate API returning a newer version available"
            >
              Available
            </button>
            <button
              type="button"
              onClick={() => handleScenarioChange('up_to_date')}
              className={`px-2 py-0.5 text-[10px] font-mono border transition-colors cursor-pointer rounded-none ${
                mockScenario === 'up_to_date'
                  ? 'bg-green/15 text-green border-green/40 font-semibold'
                  : 'bg-surface0 text-subtext0 border-surface1 hover:text-text'
              }`}
              title="Simulate API returning app is already up to date"
            >
              Up to Date
            </button>
            <button
              type="button"
              onClick={() => handleScenarioChange('error')}
              className={`px-2 py-0.5 text-[10px] font-mono border transition-colors cursor-pointer rounded-none ${
                mockScenario === 'error'
                  ? 'bg-red/15 text-red border-red/40 font-semibold'
                  : 'bg-surface0 text-subtext0 border-surface1 hover:text-text'
              }`}
              title="Simulate API connection failure"
            >
              Error
            </button>
          </div>

          {/* Right Side: Primary and Secondary Action Buttons */}
          <div className="flex items-center gap-2">
            {status === 'checking' && (
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-1.5 text-xs text-subtext0 hover:text-text bg-surface1 hover:bg-surface2 transition-colors cursor-pointer rounded-none"
              >
                Cancel
              </button>
            )}

            {status === 'up-to-date' && (
              <>
                <button
                  type="button"
                  onClick={() => void checkForUpdates(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-subtext1 hover:text-text bg-surface0 hover:bg-surface1 transition-colors cursor-pointer border border-surface1 rounded-none"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Check Again</span>
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-1.5 text-xs font-semibold text-text bg-surface1 hover:bg-surface2 transition-colors cursor-pointer border border-surface1 rounded-none"
                >
                  Done
                </button>
              </>
            )}

            {status === 'available' && (
              <>
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-3.5 py-1.5 text-xs text-subtext1 hover:text-text bg-surface0 hover:bg-surface1 transition-colors cursor-pointer border border-surface1 rounded-none"
                >
                  Remind Me Later
                </button>
                <button
                  type="button"
                  onClick={startDownload}
                  className="flex items-center gap-1.5 px-5 py-1.5 text-xs font-semibold text-[#11111b] bg-blue hover:brightness-110 transition-all cursor-pointer shadow-sm rounded-none"
                >
                  <DownloadCloud className="w-3.5 h-3.5" />
                  <span>Download &amp; Install</span>
                </button>
              </>
            )}

            {status === 'downloading' && (
              <button
                type="button"
                onClick={cancelDownload}
                className="px-4 py-1.5 text-xs text-subtext1 hover:text-text bg-surface1 hover:bg-surface2 transition-colors cursor-pointer border border-surface1 rounded-none"
              >
                Cancel Download
              </button>
            )}

            {status === 'ready' && (
              <>
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-3.5 py-1.5 text-xs text-subtext1 hover:text-text bg-surface0 hover:bg-surface1 transition-colors cursor-pointer border border-surface1 rounded-none"
                >
                  Later
                </button>
                <button
                  type="button"
                  onClick={() => void applyUpdateAndRestart()}
                  className="flex items-center gap-1.5 px-5 py-1.5 text-xs font-semibold text-[#11111b] bg-green hover:brightness-110 transition-all cursor-pointer shadow-sm rounded-none"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Restart &amp; Update Now</span>
                </button>
              </>
            )}

            {status === 'error' && (
              <>
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-3.5 py-1.5 text-xs text-subtext1 hover:text-text bg-surface0 hover:bg-surface1 transition-colors cursor-pointer border border-surface1 rounded-none"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => void checkForUpdates(false)}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-text bg-surface1 hover:bg-surface2 transition-colors cursor-pointer border border-surface1 rounded-none"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
