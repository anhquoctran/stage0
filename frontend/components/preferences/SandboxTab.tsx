import React, { useState } from 'react';
import {
  Box,
  Check,
  Layers,
  HardDrive,
  Cpu,
  ShieldCheck,
  Zap,
  Terminal,
  Play,
  Trash2,
  RotateCw,
  AlertCircle,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { SandboxType } from '../../types/git';

interface SandboxTabProps {
  draftSandboxType: SandboxType;
  onSelectAdapter: (type: SandboxType) => void;
  isPendingCommit?: boolean;
}

export const SandboxTab: React.FC<SandboxTabProps> = ({
  draftSandboxType,
  onSelectAdapter,
  isPendingCommit = false,
}) => {
  const {
    activeSandboxType: committedSandboxType,
    availableSandboxes,
    activeSandboxInstances,
    isSandboxLoading,
    fetchAvailableSandboxes,
    createSandboxInstance,
    destroySandboxInstance,
    executeSandboxCommand,
    currentRepo,
    showToast,
  } = useGitStore();

  const [testCmd, setTestCmd] = useState('git status');
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');
  const [cmdRunning, setCmdRunning] = useState(false);
  const [cmdOutput, setCmdOutput] = useState<{
    stdout: string;
    stderr: string;
    exitCode: number;
    durationMs: number;
  } | null>(null);

  const dockerInfo = availableSandboxes.find((s) => s.adapter_type === 'docker');

  const handleCreateInstance = async () => {
    if (!currentRepo) {
      showToast('Please open a repository first');
      return;
    }
    if (isPendingCommit) {
      showToast('Please click Apply or OK to commit the new engine before provisioning instances');
      return;
    }
    const inst = await createSandboxInstance();
    if (inst) {
      setSelectedInstanceId(inst.id);
    }
  };

  const handleRunCommand = async () => {
    if (!selectedInstanceId && activeSandboxInstances.length > 0) {
      setSelectedInstanceId(activeSandboxInstances[0].id);
    }
    const targetId = selectedInstanceId || activeSandboxInstances[0]?.id;
    if (!targetId) {
      showToast('Please create or select an active sandbox instance first');
      return;
    }

    const parts = testCmd.trim().split(/\s+/);
    if (parts.length === 0 || !parts[0]) return;

    setCmdRunning(true);
    setCmdOutput(null);
    try {
      const res = await executeSandboxCommand(targetId, parts[0], parts.slice(1));
      if (res) {
        setCmdOutput({
          stdout: res.stdout,
          stderr: res.stderr,
          exitCode: res.exit_code,
          durationMs: res.duration_ms,
        });
      }
    } finally {
      setCmdRunning(false);
    }
  };

  const getAdapterName = (type: SandboxType) => {
    switch (type) {
      case 'in_memory':
        return 'InMemorySandboxAdapter';
      case 'local_worktree':
        return 'LocalWorktreeSandboxAdapter';
      case 'docker':
        return 'DockerSandboxAdapter';
    }
  };

  return (
    <div className="space-y-5">
      {/* Tab Header */}
      <div className="flex items-center justify-between pb-3 border-b border-surface0">
        <div>
          <h3 className="text-sm font-bold text-text flex items-center gap-2">
            <Box className="w-4 h-4 text-blue" />
            Sandbox Execution Architecture
          </h3>
          <p className="text-[11px] text-subtext0 mt-0.5">
            Select the branch evaluation and test isolation engine. Changes are held in transaction until applied.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchAvailableSandboxes()}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-surface0 hover:bg-surface1 border border-surface1 text-text transition-colors cursor-pointer"
          title="Refresh adapter statuses"
        >
          <RotateCw className="w-3.5 h-3.5 text-subtext0" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Transaction Notice Banner (if uncommitted change) */}
      {isPendingCommit && (
        <div className="p-3 bg-amber-400/10 border border-amber-400/25 rounded-xl text-xs flex items-center justify-between text-text animate-in fade-in duration-100">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Transaction Pending:</strong> Engine changed to{' '}
              <span className="font-mono text-amber-400 font-bold">{getAdapterName(draftSandboxType)}</span>.
              Click <strong>Apply</strong> or <strong>OK</strong> to commit changes.
            </span>
          </div>
          <span className="text-[10px] text-subtext0 font-mono">Uncommitted</span>
        </div>
      )}

      {/* Adapter Option Cards (Full-Width List Stack) */}
      <div className="space-y-3">
        {/* 1. InMemorySandboxAdapter */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onSelectAdapter('in_memory')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelectAdapter('in_memory');
            }
          }}
          className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-4 select-none ${
            draftSandboxType === 'in_memory'
              ? 'bg-blue/10 border-blue shadow-xs ring-1 ring-blue/30'
              : 'bg-mantle border-surface0 hover:border-surface2 hover:bg-surface0/40'
          }`}
        >
          {/* Left Icon Container */}
          <div className="w-10 h-10 rounded-xl bg-surface0 border border-surface1 flex items-center justify-center shrink-0 mt-0.5">
            <Zap className="w-5 h-5 text-amber-400" />
          </div>

          {/* Middle Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h4 className="text-sm font-bold text-text">In-Memory Sandbox</h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface1 text-subtext1 uppercase tracking-wider">
                Default
              </span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface0 text-subtext0 border border-surface1">
                Zero Disk Footprint
              </span>
              {committedSandboxType === 'in_memory' && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green/10 text-green border border-green/20">
                  Current Engine
                </span>
              )}
            </div>

            <p className="text-xs text-subtext1 leading-relaxed">
              Zero disk writes. Evaluates virtual merge requests entirely within memory using Git object trees and blobs.
            </p>

            <div className="mt-2.5 flex items-center gap-4 text-[11px] text-subtext0 flex-wrap">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-green shrink-0" />
                <span>100% Non-destructive</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Instant initialization</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue shrink-0" />
                <span>Pure Git Object Database</span>
              </span>
            </div>
          </div>

          {/* Right Selection Indicator */}
          <div className="shrink-0 flex flex-col items-end gap-1 pt-0.5">
            {draftSandboxType === 'in_memory' ? (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue text-white text-xs font-bold shadow-xs">
                <Check className="w-3.5 h-3.5" />
                <span>Selected</span>
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full border-2 border-surface2 hover:border-subtext0 transition-colors" />
            )}
            {draftSandboxType === 'in_memory' && draftSandboxType !== committedSandboxType && (
              <span className="text-[10px] text-amber-400 font-medium">Pending Apply</span>
            )}
          </div>
        </div>

        {/* 2. LocalWorktreeSandboxAdapter */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onSelectAdapter('local_worktree')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelectAdapter('local_worktree');
            }
          }}
          className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-4 select-none ${
            draftSandboxType === 'local_worktree'
              ? 'bg-blue/10 border-blue shadow-xs ring-1 ring-blue/30'
              : 'bg-mantle border-surface0 hover:border-surface2 hover:bg-surface0/40'
          }`}
        >
          {/* Left Icon Container */}
          <div className="w-10 h-10 rounded-xl bg-surface0 border border-surface1 flex items-center justify-center shrink-0 mt-0.5">
            <HardDrive className="w-5 h-5 text-blue" />
          </div>

          {/* Middle Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h4 className="text-sm font-bold text-text">Local Worktree Sandbox</h4>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface0 text-subtext0 border border-surface1">
                Isolated Scratchpad
              </span>
              {committedSandboxType === 'local_worktree' && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green/10 text-green border border-green/20">
                  Current Engine
                </span>
              )}
            </div>

            <p className="text-xs text-subtext1 leading-relaxed">
              Creates a detached Git worktree in the system temp directory (%TEMP%/stage0-worktrees). Allows running local test suites, linters, and compilers without touching your active branch.
            </p>

            <div className="mt-2.5 flex items-center gap-4 text-[11px] text-subtext0 flex-wrap">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-blue shrink-0" />
                <span>Runs tests & linters</span>
              </span>
              <span className="flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-green shrink-0" />
                <span>Temp disk directory</span>
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Auto-prune on exit</span>
              </span>
            </div>
          </div>

          {/* Right Selection Indicator */}
          <div className="shrink-0 flex flex-col items-end gap-1 pt-0.5">
            {draftSandboxType === 'local_worktree' ? (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue text-white text-xs font-bold shadow-xs">
                <Check className="w-3.5 h-3.5" />
                <span>Selected</span>
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full border-2 border-surface2 hover:border-subtext0 transition-colors" />
            )}
            {draftSandboxType === 'local_worktree' && draftSandboxType !== committedSandboxType && (
              <span className="text-[10px] text-amber-400 font-medium">Pending Apply</span>
            )}
          </div>
        </div>

        {/* 3. DockerSandboxAdapter */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onSelectAdapter('docker')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelectAdapter('docker');
            }
          }}
          className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-4 select-none ${
            draftSandboxType === 'docker'
              ? 'bg-blue/10 border-blue shadow-xs ring-1 ring-blue/30'
              : 'bg-mantle border-surface0 hover:border-surface2 hover:bg-surface0/40'
          }`}
        >
          {/* Left Icon Container */}
          <div className="w-10 h-10 rounded-xl bg-surface0 border border-surface1 flex items-center justify-center shrink-0 mt-0.5">
            <Cpu className="w-5 h-5 text-cyan-400" />
          </div>

          {/* Middle Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h4 className="text-sm font-bold text-text">Docker Container Sandbox</h4>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  dockerInfo?.is_available
                    ? 'bg-green/10 text-green border border-green/20'
                    : 'bg-surface1 text-subtext0'
                }`}
              >
                {dockerInfo?.is_available ? 'Daemon Ready' : 'Daemon Offline'}
              </span>
              {committedSandboxType === 'docker' && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green/10 text-green border border-green/20">
                  Current Engine
                </span>
              )}
            </div>

            <p className="text-xs text-subtext1 leading-relaxed">
              Launches an isolated Docker container with the repository mounted for reproducible CI verification and process isolation.
            </p>

            <div className="mt-2.5 flex items-center gap-4 text-[11px] text-subtext0 flex-wrap">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>Full OS & Process Isolation</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-blue shrink-0" />
                <span>Reproducible CI Environment</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span>Default: alpine:latest</span>
              </span>
            </div>
          </div>

          {/* Right Selection Indicator */}
          <div className="shrink-0 flex flex-col items-end gap-1 pt-0.5">
            {draftSandboxType === 'docker' ? (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue text-white text-xs font-bold shadow-xs">
                <Check className="w-3.5 h-3.5" />
                <span>Selected</span>
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full border-2 border-surface2 hover:border-subtext0 transition-colors" />
            )}
            {draftSandboxType === 'docker' && draftSandboxType !== committedSandboxType && (
              <span className="text-[10px] text-amber-400 font-medium">Pending Apply</span>
            )}
          </div>
        </div>
      </div>

      {/* Active Diagnostics Card */}
      <div className="bg-mantle border border-surface0 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-text uppercase tracking-wider">
            Engine Capability Matrix
          </span>
          <span className="text-xs font-mono font-semibold text-blue">
            {getAdapterName(draftSandboxType)}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-surface0/60 p-2.5 rounded-lg border border-surface1">
            <span className="text-[10px] text-subtext0 uppercase font-semibold block">Isolation</span>
            <span className="font-mono font-bold text-text">
              {draftSandboxType === 'in_memory'
                ? 'In-Memory (None)'
                : draftSandboxType === 'local_worktree'
                ? 'Worktree (Disk)'
                : 'Container (OS)'}
            </span>
          </div>

          <div className="bg-surface0/60 p-2.5 rounded-lg border border-surface1">
            <span className="text-[10px] text-subtext0 uppercase font-semibold block">Run Commands</span>
            <span
              className={`font-mono font-bold ${
                draftSandboxType === 'in_memory' ? 'text-subtext0' : 'text-green'
              }`}
            >
              {draftSandboxType === 'in_memory' ? 'No' : 'Supported'}
            </span>
          </div>

          <div className="bg-surface0/60 p-2.5 rounded-lg border border-surface1">
            <span className="text-[10px] text-subtext0 uppercase font-semibold block">Write Files</span>
            <span
              className={`font-mono font-bold ${
                draftSandboxType === 'in_memory' ? 'text-subtext0' : 'text-green'
              }`}
            >
              {draftSandboxType === 'in_memory' ? 'No' : 'Isolated'}
            </span>
          </div>

          <div className="bg-surface0/60 p-2.5 rounded-lg border border-surface1">
            <span className="text-[10px] text-subtext0 uppercase font-semibold block">Daemon Required</span>
            <span className="font-mono font-bold text-text">
              {draftSandboxType === 'docker' ? 'Yes (Docker)' : 'No (Native)'}
            </span>
          </div>
        </div>
      </div>

      {/* Active Instances & Execution Section (Active committed environment) */}
      {committedSandboxType !== 'in_memory' && (
        <div className="bg-mantle border border-surface0 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-text uppercase tracking-wider">
                Active Sandbox Instances ({activeSandboxInstances.length})
              </h4>
              <p className="text-[11px] text-subtext0">
                Detached scratch environments provisioned with {getAdapterName(committedSandboxType)}.
              </p>
            </div>

            <button
              type="button"
              onClick={handleCreateInstance}
              disabled={isSandboxLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue hover:bg-blue/90 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Box className="w-3.5 h-3.5" />
              <span>Provision Instance</span>
            </button>
          </div>

          {activeSandboxInstances.length === 0 ? (
            <div className="p-4 border border-dashed border-surface1 rounded-lg text-center text-xs text-subtext0">
              No active sandbox instances provisioned yet. Click "Provision Instance" to create one.
            </div>
          ) : (
            <div className="space-y-2">
              {activeSandboxInstances.map((inst) => (
                <div
                  key={inst.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedInstanceId(inst.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedInstanceId(inst.id);
                    }
                  }}
                  className={`flex items-center justify-between p-3 rounded-lg border text-xs transition-colors cursor-pointer ${
                    selectedInstanceId === inst.id ||
                    (activeSandboxInstances.length === 1 && !selectedInstanceId)
                      ? 'bg-surface0 border-blue'
                      : 'bg-mantle border-surface1 hover:border-surface2'
                  }`}
                >
                  <div className="font-mono space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-text">{inst.id}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface2 text-text uppercase font-semibold">
                        {inst.adapter_type}
                      </span>
                    </div>
                    <div className="text-[11px] text-subtext1">
                      {inst.worktree_path || inst.container_id || inst.repo_path}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      destroySandboxInstance(inst.id);
                    }}
                    className="p-1.5 rounded text-subtext0 hover:text-red hover:bg-red/10 transition-colors cursor-pointer"
                    title="Destroy this sandbox instance"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Sandbox Terminal Runner */}
          {activeSandboxInstances.length > 0 && (
            <div className="pt-3 border-t border-surface0 space-y-2">
              <label htmlFor="sandbox-command-input" className="text-xs font-bold text-text flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-blue" />
                Run Command in Sandbox Instance
              </label>

              <div className="flex items-center gap-2">
                <input
                  id="sandbox-command-input"
                  type="text"
                  value={testCmd}
                  onChange={(e) => setTestCmd(e.target.value)}
                  placeholder="e.g. npm test or cargo test"
                  className="flex-1 bg-surface0 border border-surface1 rounded-md px-3 py-1.5 text-xs font-mono text-text focus:outline-none focus:border-blue"
                />

                <button
                  type="button"
                  onClick={handleRunCommand}
                  disabled={cmdRunning}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-green text-white text-xs font-bold hover:bg-green/90 transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{cmdRunning ? 'Running...' : 'Execute'}</span>
                </button>
              </div>

              {cmdOutput && (
                <div className="mt-3 bg-crust border border-surface0 rounded-lg p-3 text-xs font-mono space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-subtext0 border-b border-surface0 pb-1.5">
                    <span>Exit Code: {cmdOutput.exitCode}</span>
                    <span>Duration: {cmdOutput.durationMs}ms</span>
                  </div>
                  {cmdOutput.stdout && (
                    <pre className="text-text whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {cmdOutput.stdout}
                    </pre>
                  )}
                  {cmdOutput.stderr && (
                    <pre className="text-red whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {cmdOutput.stderr}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
