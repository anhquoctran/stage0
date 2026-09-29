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
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { SandboxType } from '../../types/git';

export const SandboxTab: React.FC = () => {
  const {
    activeSandboxType,
    availableSandboxes,
    activeSandboxInstances,
    isSandboxLoading,
    setActiveSandbox,
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

  const handleSelectAdapter = async (type: SandboxType) => {
    if (type === activeSandboxType) return;
    await setActiveSandbox(type);
  };

  const handleCreateInstance = async () => {
    if (!currentRepo) {
      showToast('Please open a repository first');
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
    const targetId = selectedInstanceId || (activeSandboxInstances[0]?.id);
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

  const getAdapterIcon = (type: SandboxType) => {
    switch (type) {
      case 'in_memory':
        return <Zap className="w-5 h-5 text-amber-400" />;
      case 'local_worktree':
        return <HardDrive className="w-5 h-5 text-blue" />;
      case 'docker':
        return <Cpu className="w-5 h-5 text-cyan-400" />;
    }
  };

  const dockerInfo = availableSandboxes.find((s) => s.adapter_type === 'docker');

  return (
    <div className="space-y-6">
      {/* Tab Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-text flex items-center gap-2">
            <Box className="w-4 h-4 text-blue" />
            Sandbox Execution Architecture
          </h3>
          <p className="text-xs text-subtext0 mt-0.5">
            Configure how Stage0 isolates branch evaluation, calculates virtual diffs, and executes tests.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchAvailableSandboxes()}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded bg-surface0 hover:bg-surface1 border border-surface1 text-text transition-colors cursor-pointer"
          title="Refresh adapter statuses"
        >
          <RotateCw className="w-3.5 h-3.5 text-subtext0" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Adapter Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. InMemorySandboxAdapter */}
        <div
          onClick={() => handleSelectAdapter('in_memory')}
          className={`flex flex-col justify-between p-4 rounded-xl border transition-all cursor-pointer relative ${
            activeSandboxType === 'in_memory'
              ? 'bg-blue/10 border-blue shadow-md'
              : 'bg-mantle border-surface0 hover:border-surface2 hover:bg-surface0/40'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-surface0 border border-surface1">
                {getAdapterIcon('in_memory')}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface1 text-subtext1 uppercase">
                  Default
                </span>
                {activeSandboxType === 'in_memory' && (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-blue px-2 py-0.5 rounded-full bg-blue/20 border border-blue/30">
                    <Check className="w-3 h-3" />
                    Active
                  </span>
                )}
              </div>
            </div>

            <h4 className="text-sm font-bold text-text">In-Memory Sandbox</h4>
            <p className="text-xs text-subtext1 mt-1 leading-relaxed">
              Zero disk footprint. Evaluates virtual merge requests entirely within memory using Git object trees and blobs.
            </p>

            <ul className="mt-4 space-y-1.5 text-[11px] text-subtext0">
              <li className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-green shrink-0" />
                <span>100% Non-destructive</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Instant initialization</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue shrink-0" />
                <span>No temp files on disk</span>
              </li>
            </ul>
          </div>

          <div className="mt-4 pt-3 border-t border-surface0 text-[10px] text-subtext0">
            Recommended for standard MR reviews
          </div>
        </div>

        {/* 2. LocalWorktreeSandboxAdapter */}
        <div
          onClick={() => handleSelectAdapter('local_worktree')}
          className={`flex flex-col justify-between p-4 rounded-xl border transition-all cursor-pointer relative ${
            activeSandboxType === 'local_worktree'
              ? 'bg-blue/10 border-blue shadow-md'
              : 'bg-mantle border-surface0 hover:border-surface2 hover:bg-surface0/40'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-surface0 border border-surface1">
                {getAdapterIcon('local_worktree')}
              </div>
              {activeSandboxType === 'local_worktree' && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-blue px-2 py-0.5 rounded-full bg-blue/20 border border-blue/30">
                  <Check className="w-3 h-3" />
                  Active
                </span>
              )}
            </div>

            <h4 className="text-sm font-bold text-text">Local Worktree Sandbox</h4>
            <p className="text-xs text-subtext1 mt-1 leading-relaxed">
              Creates an isolated Git worktree on disk. Lets you run local test suites, linters, and compilers without touching your active branch.
            </p>

            <ul className="mt-4 space-y-1.5 text-[11px] text-subtext0">
              <li className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-blue shrink-0" />
                <span>Execute test commands</span>
              </li>
              <li className="flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-green shrink-0" />
                <span>Isolated disk folder</span>
              </li>
              <li className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Auto-prune on exit</span>
              </li>
            </ul>
          </div>

          <div className="mt-4 pt-3 border-t border-surface0 text-[10px] text-subtext0 truncate">
            Location: System Temp Dir
          </div>
        </div>

        {/* 3. DockerSandboxAdapter */}
        <div
          onClick={() => handleSelectAdapter('docker')}
          className={`flex flex-col justify-between p-4 rounded-xl border transition-all cursor-pointer relative ${
            activeSandboxType === 'docker'
              ? 'bg-blue/10 border-blue shadow-md'
              : 'bg-mantle border-surface0 hover:border-surface2 hover:bg-surface0/40'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-surface0 border border-surface1">
                {getAdapterIcon('docker')}
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    dockerInfo?.is_available
                      ? 'bg-green/10 text-green border border-green/20'
                      : 'bg-surface1 text-subtext0'
                  }`}
                >
                  {dockerInfo?.is_available ? 'Daemon Ready' : 'Daemon Offline'}
                </span>
                {activeSandboxType === 'docker' && (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-blue px-2 py-0.5 rounded-full bg-blue/20 border border-blue/30">
                    <Check className="w-3 h-3" />
                    Active
                  </span>
                )}
              </div>
            </div>

            <h4 className="text-sm font-bold text-text">Docker Container Sandbox</h4>
            <p className="text-xs text-subtext1 mt-1 leading-relaxed">
              Launches an isolated Docker container with the repository mounted for reproducible CI verification and process isolation.
            </p>

            <ul className="mt-4 space-y-1.5 text-[11px] text-subtext0">
              <li className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>Full OS & Process Isolation</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-blue shrink-0" />
                <span>Reproducible CI Environment</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span>Configurable container image</span>
              </li>
            </ul>
          </div>

          <div className="mt-4 pt-3 border-t border-surface0 text-[10px] text-subtext0 truncate">
            Default: alpine:latest
          </div>
        </div>
      </div>

      {/* Active Adapter Capabilities & Status Card */}
      <div className="bg-mantle border border-surface0 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-text uppercase tracking-wider">
            Active Adapter Diagnostic
          </span>
          <span className="text-xs font-mono font-semibold text-blue">
            {activeSandboxType === 'in_memory'
              ? 'InMemorySandboxAdapter'
              : activeSandboxType === 'local_worktree'
              ? 'LocalWorktreeSandboxAdapter'
              : 'DockerSandboxAdapter'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-surface0/60 p-2.5 rounded-lg border border-surface1">
            <span className="text-[10px] text-subtext0 uppercase font-semibold block">Isolation</span>
            <span className="font-mono font-bold text-text">
              {activeSandboxType === 'in_memory'
                ? 'In-Memory (None)'
                : activeSandboxType === 'local_worktree'
                ? 'Worktree (Disk)'
                : 'Container (OS)'}
            </span>
          </div>

          <div className="bg-surface0/60 p-2.5 rounded-lg border border-surface1">
            <span className="text-[10px] text-subtext0 uppercase font-semibold block">Run Commands</span>
            <span className={`font-mono font-bold ${activeSandboxType === 'in_memory' ? 'text-subtext0' : 'text-green'}`}>
              {activeSandboxType === 'in_memory' ? 'No' : 'Supported'}
            </span>
          </div>

          <div className="bg-surface0/60 p-2.5 rounded-lg border border-surface1">
            <span className="text-[10px] text-subtext0 uppercase font-semibold block">Write Files</span>
            <span className={`font-mono font-bold ${activeSandboxType === 'in_memory' ? 'text-subtext0' : 'text-green'}`}>
              {activeSandboxType === 'in_memory' ? 'No' : 'Isolated'}
            </span>
          </div>

          <div className="bg-surface0/60 p-2.5 rounded-lg border border-surface1">
            <span className="text-[10px] text-subtext0 uppercase font-semibold block">Daemon Required</span>
            <span className="font-mono font-bold text-text">
              {activeSandboxType === 'docker' ? 'Yes (Docker)' : 'No (Native)'}
            </span>
          </div>
        </div>

        {/* Informational Note for In-Memory */}
        {activeSandboxType === 'in_memory' && (
          <div className="p-3 bg-blue/10 border border-blue/20 rounded-lg text-xs text-text flex items-start gap-2.5">
            <Zap className="w-4 h-4 text-blue shrink-0 mt-0.5" />
            <p className="leading-relaxed text-[11px] text-subtext1">
              <strong>In-Memory Sandbox is active:</strong> Stage0 uses Git internal object graphs to compare branches and detect merge conflicts without creating temporary files or switching branches. To run tests, select <strong>Local Worktree</strong> or <strong>Docker</strong> above.
            </p>
          </div>
        )}
      </div>

      {/* Active Instances & Command Execution Section (for LocalWorktree and Docker) */}
      {activeSandboxType !== 'in_memory' && (
        <div className="bg-mantle border border-surface0 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-text uppercase tracking-wider">
                Active Sandbox Instances ({activeSandboxInstances.length})
              </h4>
              <p className="text-[11px] text-subtext0">
                Manage detached execution environments for the current virtual MR.
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
                  onClick={() => setSelectedInstanceId(inst.id)}
                  className={`flex items-center justify-between p-3 rounded-lg border text-xs transition-colors cursor-pointer ${
                    selectedInstanceId === inst.id || (activeSandboxInstances.length === 1 && !selectedInstanceId)
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
              <label className="text-xs font-bold text-text flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-blue" />
                Run Command in Sandbox Instance
              </label>

              <div className="flex items-center gap-2">
                <input
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
