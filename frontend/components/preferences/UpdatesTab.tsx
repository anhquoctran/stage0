import React from 'react';
import { useUpdateStore } from '../../store/useUpdateStore';
import { SOFTWARE_ABOUT } from '../../config/about';
import type { UpdateChannel } from '../../types/update';
import {
  DownloadCloud,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Sparkles,
  Clock,
} from '@/components/common/icons';
import { CustomSelect, type CustomSelectOption } from '@/components/common/CustomSelect';

const FREQUENCY_OPTIONS: CustomSelectOption<'daily' | 'weekly' | 'monthly'>[] = [
  {
    value: 'daily',
    label: 'Daily',
    description: 'Check for updates every 24 hours',
  },
  {
    value: 'weekly',
    label: 'Weekly',
    description: 'Check for updates every 7 days',
  },
  {
    value: 'monthly',
    label: 'Monthly',
    description: 'Check for updates every 30 days',
  },
];

const CHANNEL_OPTIONS: CustomSelectOption<UpdateChannel>[] = [
  {
    value: 'dev',
    label: 'Development',
    description: 'Development builds for early testing',
  },
  {
    value: 'staging',
    label: 'Staging',
    description: 'Pre-release builds for final verification',
  },
  {
    value: 'beta',
    label: 'Beta / Preview',
    description: 'Early access builds with experimental features',
    badge: 'Preview',
  },
  {
    value: 'stable',
    label: 'Stable',
    description: 'Official production builds (recommended)',
    badge: 'Recommended',
  },
];

export const UpdatesTab: React.FC = () => {
  const {
    status,
    updatePayload,
    downloadProgress,
    downloadSpeed,
    downloadedText,
    downloadedArtifactPath,
    errorMessage,
    lastCheckedTime,
    updateCheckPolicy,
    updateCheckFrequency,
    updateChannel,
    setUpdateCheckPolicy,
    setUpdateCheckFrequency,
    setUpdateChannel,
    checkForUpdates,
    startDownload,
    cancelDownload,
    installDownloadedUpdate,
  } = useUpdateStore();

  const currentVersion = SOFTWARE_ABOUT.packageVersion;
  const osName = SOFTWARE_ABOUT.os?.toLowerCase() || 'unknown';
  const rawArchName = SOFTWARE_ABOUT.arch.toLowerCase();
  const archName = ({
    aarch64: 'arm64',
    amd64: 'x64',
    x86_64: 'x64',
    i386: 'x86',
    i686: 'x86',
  } as Record<string, string>)[rawArchName] || rawArchName;

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let value = bytes / 1024;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024;
      unit += 1;
    }
    return `${value.toFixed(1)} ${units[unit]}`;
  };

  const channelLabel: Record<UpdateChannel, string> = {
    dev: 'Development Track',
    staging: 'Staging Track',
    beta: 'Beta Preview',
    stable: 'Stable Track',
  };

  const initialCheckStarted = React.useRef(false);
  React.useEffect(() => {
    if (status === 'idle' && !initialCheckStarted.current) {
      initialCheckStarted.current = true;
      void checkForUpdates(true);
    }
  }, [status, checkForUpdates]);

  return (
    <div className="space-y-6 animate-in fade-in duration-100 select-none pb-4">
      {/* 1. CURRENT VERSION & SYSTEM PROFILE CARD */}
      <div className="preferences-panel-card border p-4.5 rounded">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-text tracking-tight">Stage0</span>
              <span className="px-2 py-0.5 text-xs font-mono font-semibold bg-surface0/80 text-text border border-surface1/60 rounded">
                v{currentVersion}
              </span>
              <span className="px-2 py-0.5 text-[10px] font-mono uppercase bg-brand/15 text-brand border border-brand/30 rounded">
                {channelLabel[updateChannel]}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-subtext0 font-mono">
              <span>Platform: <strong className="text-subtext1 capitalize">{osName}</strong> ({archName})</span>
              <span>•</span>
              <span>Commit: <strong className="text-subtext1">{SOFTWARE_ABOUT.gitCommit || 'latest'}</strong></span>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-subtext0 pt-0.5">
              <Clock className="w-3 h-3 text-subtext0/70" />
              <span>
                {lastCheckedTime
                  ? `Last verified: Today at ${lastCheckedTime}`
                  : 'Update status not checked yet in this session.'}
              </span>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <button
              type="button"
              disabled={status === 'checking' || status === 'downloading' || status === 'cancelling'}
              onClick={() => void checkForUpdates(true)}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-on-accent bg-brand hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer shadow-sm rounded"
            >
              {status === 'checking' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Checking...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Check for Updates</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 2. DYNAMIC UPDATE STATUS BANNER */}
      {status === 'checking' && (
        <div className="preferences-panel-card p-4 border rounded flex flex-col items-center justify-center py-6 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-brand animate-spin" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-text">Checking for Updates...</h4>
            <p className="text-xs text-subtext0">
              Checking the Stage0 update service for {osName} ({archName})
            </p>
          </div>
          <div className="bg-mantle border border-surface0 px-3 py-1 text-[11px] font-mono text-subtext1 rounded">
            currentVersion={currentVersion}&amp;platform={osName}&amp;arch={archName}&amp;channel={updateChannel}
          </div>
        </div>
      )}

      {status === 'up-to-date' && (
        <div className="p-4 bg-green/10 border border-green/30 rounded flex items-start gap-3.5">
          <div className="w-8 h-8 bg-green/15 border border-green/30 flex items-center justify-center text-green shrink-0 rounded">
            <CheckCircle2 className="w-4.5 h-4.5 text-green" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-text">You&apos;re running the latest version!</h4>
            <p className="text-xs text-subtext0 leading-relaxed">
              Stage0 <span className="font-mono text-text font-medium">v{currentVersion}</span> is currently up to date on the {updateChannel} channel for{' '}
              <span className="capitalize">{osName}</span> ({archName}). No updates are required.
            </p>
          </div>
        </div>
      )}

      {status === 'available' && updatePayload && (
        <div className="preferences-panel-card p-4.5 border rounded space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-brand/15 text-brand border border-brand/30 text-[10px] font-mono font-semibold uppercase rounded">
                  New Release Available
                </span>
                <h4 className="text-sm font-bold text-text">
                  Stage0 v{updatePayload.version}
                </h4>
              </div>
              <p className="text-xs text-subtext0">
                {updatePayload.sizeBytes == null ? 'Package size not provided' : `Download size: ${formatBytes(updatePayload.sizeBytes)}`}
                {updatePayload.codename ? ` • ${updatePayload.codename}` : ''}
              </p>
            </div>

            <button
              type="button"
              onClick={() => void startDownload()}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-on-accent bg-brand hover:brightness-110 transition-all cursor-pointer shadow-sm shrink-0 rounded"
            >
              <DownloadCloud className="w-3.5 h-3.5" />
              <span>Download &amp; Install</span>
            </button>
          </div>

          {/* Release Notes */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-text">
              <Sparkles className="w-3.5 h-3.5 text-brand" />
              <span>What&apos;s New in this Release:</span>
            </div>
            <div className="bg-mantle border border-surface0 p-3 max-h-36 overflow-y-auto text-xs text-subtext0 leading-relaxed whitespace-pre-line rounded">
              {updatePayload.changelog || 'No release notes were provided for this release.'}
            </div>
          </div>
        </div>
      )}

      {(status === 'downloading' || status === 'cancelling') && (
        <div className="preferences-panel-card p-4.5 border rounded space-y-3.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-text">
              {status === 'cancelling' ? 'Cancelling update download…' : `Downloading Stage0 v${updatePayload?.version || 'Update'}…`}
            </span>
            <span className="font-mono text-brand font-bold">
              {downloadProgress == null ? '—' : `${downloadProgress}%`}
            </span>
          </div>

          <div className="w-full bg-mantle border border-surface0 h-2.5 rounded overflow-hidden">
            <div
              style={{ width: downloadProgress == null ? '35%' : `${downloadProgress}%` }}
              className={`bg-brand h-full transition-all duration-200 ease-out ${downloadProgress == null ? 'animate-pulse' : ''}`}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-subtext0 font-mono">
            <span>{downloadedText}</span>
            <span>{downloadSpeed}</span>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-subtext0">
              Please do not close Stage0 while the update payload is being transferred.
            </span>
            <button
              type="button"
              onClick={() => void cancelDownload()}
              disabled={status === 'cancelling'}
              className="px-3 py-1 text-xs text-subtext0 hover:text-text bg-surface0/60 hover:bg-surface0 border border-surface1/50 rounded cursor-pointer transition-colors"
            >
              Cancel Download
            </button>
          </div>
        </div>
      )}

      {status === 'ready' && (
        <div className="p-4.5 bg-green/10 border border-green/30 rounded space-y-3.5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-green/15 border border-green/30 flex items-center justify-center text-green shrink-0 rounded">
              <CheckCircle2 className="w-4.5 h-4.5 text-green" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-text">Update Ready to Install</h4>
              <p className="text-xs text-subtext0 leading-relaxed">
                Stage0 v<strong className="font-mono text-text">{updatePayload?.version}</strong> has been downloaded and SHA-256 verified.
                The operating system&apos;s installer will open; the steps needed to finish depend on the package format.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1 border-t border-green/25">
            <button
              type="button"
              onClick={() => void installDownloadedUpdate()}
              disabled={!downloadedArtifactPath}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-on-accent bg-green hover:brightness-105 transition-all cursor-pointer shadow-sm rounded"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Open Installer</span>
            </button>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="preferences-danger-card p-4 border rounded flex items-start gap-3">
          <div className="preferences-danger-icon w-8 h-8 border flex items-center justify-center shrink-0 rounded">
            <AlertTriangle className="w-4.5 h-4.5" />
          </div>
          <div className="space-y-1 flex-1">
            <h4 className="text-xs font-bold text-white">Update Process Failed</h4>
            <p className="preferences-danger-text text-xs leading-relaxed">
              {errorMessage || 'Unable to connect to the version management server. Please check your network connection.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void (downloadedArtifactPath ? installDownloadedUpdate() : checkForUpdates(true))}
            className="preferences-danger-action flex items-center gap-1 px-3 py-1.5 text-xs border rounded cursor-pointer transition-colors shrink-0"
          >
            <RefreshCw className="w-3 h-3" />
            <span>{downloadedArtifactPath ? 'Try Installer Again' : 'Retry'}</span>
          </button>
        </div>
      )}

      {/* 3. UPDATE PREFERENCES & SETTINGS */}
      <div className="space-y-1 pt-1">
        <h3 className="text-xs font-bold text-text tracking-tight uppercase font-mono pb-1 border-b border-surface0/50">
          Update Configuration
        </h3>

        {/* Automatic Software Update Policy */}
        <div className="py-3 border-b border-surface0/40 space-y-3">
          <div>
            <div className="text-xs font-semibold text-text">Automatic Software Updates</div>
            <div className="text-[11px] text-subtext0 mt-0.5 leading-relaxed">
              Configure how Stage0 detects, downloads, and prepares version updates.
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {/* Option 1: Disabled */}
            <div
              className={`flex items-start gap-3 p-3 border rounded cursor-pointer transition-colors ${
                updateCheckPolicy === 'disabled'
                  ? 'preferences-choice-card preferences-choice-card-selected text-text'
                  : 'preferences-choice-card hover:border-surface1 text-subtext0'
              }`}
              onClick={() => setUpdateCheckPolicy('disabled')}
            >
              <input
                type="radio"
                name="updateCheckPolicy"
                checked={updateCheckPolicy === 'disabled'}
                onChange={() => setUpdateCheckPolicy('disabled')}
                className="mt-0.5 text-brand focus:ring-0 cursor-pointer"
              />
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-text">Disabled</div>
                <div className="text-[11px] text-subtext0 leading-relaxed">
                  Do not check for updates automatically. You can check manually at any time.
                </div>
              </div>
            </div>

            {/* Option 2: Check only, notify manually */}
            <div
              className={`flex items-start gap-3 p-3 border rounded cursor-pointer transition-colors ${
                updateCheckPolicy === 'notify_only'
                  ? 'preferences-choice-card preferences-choice-card-selected text-text'
                  : 'preferences-choice-card hover:border-surface1 text-subtext0'
              }`}
              onClick={() => setUpdateCheckPolicy('notify_only')}
            >
              <input
                type="radio"
                name="updateCheckPolicy"
                checked={updateCheckPolicy === 'notify_only'}
                onChange={() => setUpdateCheckPolicy('notify_only')}
                className="mt-0.5 text-brand focus:ring-0 cursor-pointer"
              />
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-text">
                  Check for updates only (Notify)
                </div>
                <div className="text-[11px] text-subtext0 leading-relaxed">
                  Automatically check for updates on schedule and notify you when available, but do not download or install without your confirmation.
                </div>
              </div>
            </div>

            {/* Option 3: Check and automatically download & install */}
            <div
              className={`flex items-start gap-3 p-3 border rounded cursor-pointer transition-colors ${
                updateCheckPolicy === 'auto_install'
                  ? 'preferences-choice-card preferences-choice-card-selected text-text'
                  : 'preferences-choice-card hover:border-surface1 text-subtext0'
              }`}
              onClick={() => setUpdateCheckPolicy('auto_install')}
            >
              <input
                type="radio"
                name="updateCheckPolicy"
                checked={updateCheckPolicy === 'auto_install'}
                onChange={() => setUpdateCheckPolicy('auto_install')}
                className="mt-0.5 text-brand focus:ring-0 cursor-pointer"
              />
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-text">
                  Automatically download, verify, and open the installer
                </div>
                <div className="text-[11px] text-subtext0 leading-relaxed">
                  Download and verify updates on schedule, then open the operating system&apos;s installer automatically. The installer may still require confirmation or manual steps.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Check Frequency (Disabled when updateCheckPolicy is 'disabled') */}
        <div
          className={`py-3 flex items-center justify-between gap-6 border-b border-surface0/40 transition-opacity duration-150 ${
            updateCheckPolicy === 'disabled' ? 'opacity-60' : 'opacity-100'
          }`}
        >
          <div className="min-w-0 flex-1 pr-2">
            <div className="text-xs font-semibold text-text flex items-center gap-2">
              <span>Check Frequency</span>
              {updateCheckPolicy === 'disabled' && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface0/60 text-subtext0 border border-surface1/40">
                  Disabled
                </span>
              )}
            </div>
            <div className="text-[11px] text-subtext0 mt-0.5 leading-relaxed">
              {updateCheckPolicy === 'disabled'
                ? 'Automatic update checks are disabled. Select an automated policy above to enable scheduling.'
                : 'How often Stage0 queries the version management backend in the background.'}
            </div>
          </div>
          <div className="shrink-0">
            <CustomSelect
              value={updateCheckFrequency}
              options={FREQUENCY_OPTIONS}
              onChange={setUpdateCheckFrequency}
              disabled={updateCheckPolicy === 'disabled'}
              buttonClassName="min-w-[140px] sm:min-w-[160px]"
              dropdownWidth="w-64"
              align="right"
              aria-label="Check Frequency"
            />
          </div>
        </div>

        {/* Update Channel */}
        <div className="py-3 flex items-center justify-between gap-6">
          <div className="min-w-0 flex-1 pr-2">
            <div className="text-xs font-semibold text-text">Release Channel</div>
            <div className="text-[11px] text-subtext0 mt-0.5 leading-relaxed">
              Select which release channel to subscribe to for software updates.
            </div>
          </div>
          <div className="shrink-0">
            <CustomSelect
              value={updateChannel}
              options={CHANNEL_OPTIONS}
              disabled={status === 'downloading' || status === 'cancelling'}
              onChange={(channel) => {
                setUpdateChannel(channel);
                void checkForUpdates(true);
              }}
              buttonClassName="min-w-[140px] sm:min-w-[160px]"
              dropdownWidth="w-64"
              align="right"
              aria-label="Release Channel"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
