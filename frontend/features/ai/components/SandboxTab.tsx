import { useTranslation as useUiTextTranslation } from 'react-i18next';
import React from 'react';
import { RotateCw } from '../../../common/components/icons/RotateCw';
import { useGitStore } from '../../git/store/useGitStore';
import { type SandboxType } from '../../git/types/SandboxType';
import type { SandboxTabProps } from '../types/SandboxTabProps';
import { SandboxConfigForm } from './sandbox/SandboxConfigForm';
import { SandboxInstanceCard } from './sandbox/SandboxInstanceCard';
import { useSandboxCommand } from './useSandboxCommand';

export const SandboxTab: React.FC<SandboxTabProps> = ({
  draftSandboxType,
  onSelectAdapter,
  isPendingCommit = false,
}) => {
  const { t: translateUiText } = useUiTextTranslation();
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

  const {
    handleCreateInstance,
    setSelectedInstanceId,
    selectedInstanceId,
    testCmd,
    setTestCmd,
    handleRunCommand,
    cmdRunning,
    cmdOutput,
  } = useSandboxCommand({
    currentRepo,
    showToast,
    isPendingCommit,
    createSandboxInstance,
    activeSandboxInstances,
    executeSandboxCommand,
  });

  const dockerInfo = availableSandboxes.find((s) => s.adapter_type === 'docker');

  const getAdapterName = (type: SandboxType) => {
    switch (type) {
      case 'in_memory':
        return 'In-Memory';
      case 'local_worktree':
        return 'Local Worktree';
      case 'docker':
        return 'Docker Container';
    }
  };

  const adapters: {
    id: SandboxType;
    title: string;
    defaultBadge?: boolean;
    description: string;
    specs: string;
    extraBadge?: string;
  }[] = [
    {
      id: 'in_memory',
      title: 'In-Memory Sandbox',
      defaultBadge: true,
      description:
        'Evaluates branch differences and conflicts without checking out branches or changing the working tree or index. Git may write result objects to the repository object database.',
      specs: 'No command execution • No worktree or index changes • Fastest',
    },
    {
      id: 'local_worktree',
      title: 'Local Worktree Sandbox',
      description:
        'Allocates a detached Git worktree in the system temp directory. Commands run on the host as the current user and can access files outside the worktree.',
      specs: 'Separate worktree • Host permissions • Auto-pruned',
    },
    {
      id: 'docker',
      title: 'Docker Container Sandbox',
      description:
        'Copies the selected source tree into a writable Docker container without mounting host folders. Networking is enabled; Stage0 does not set CPU, memory, or process limits.',
      specs: 'Writable container • Network enabled • Docker daemon',
      extraBadge: dockerInfo?.is_available ? 'Daemon ready' : 'Daemon offline',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-surface0">
        <div>
          <h3 className="text-sm font-bold text-text">Sandbox Engine</h3>
          <p className="text-[11px] text-subtext0 mt-0.5">
            Select the branch evaluation and test isolation environment
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchAvailableSandboxes()}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-sm hover:bg-surface0 text-subtext0 hover:text-text transition-colors cursor-pointer"
          title="Refresh engine availability"
        >
          <RotateCw className="w-3 h-3" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Transaction Notice (if uncommitted) */}
      {isPendingCommit && (
        <div className="px-3 py-2 bg-surface0/50 rounded-sm text-xs flex items-center justify-between text-subtext1">
          <span>
            Pending change: switch to{' '}
            <strong className="text-text font-mono">{getAdapterName(draftSandboxType)}</strong>.
            Click <strong>Apply</strong> or <strong>{translateUiText('common.ok')}</strong> to commit.
          </span>
          <span className="text-[10px] text-subtext0 font-mono uppercase">Uncommitted</span>
        </div>
      )}

      {/* Monochrome Adapter Radio List */}
      <SandboxConfigForm
        adapters={adapters}
        draftSandboxType={draftSandboxType}
        committedSandboxType={committedSandboxType}
        onSelectAdapter={onSelectAdapter}
      />

      {/* Engine Technical Specifications */}
      <div className="p-3.5 bg-surface0/20 border border-surface0 rounded-sm text-xs space-y-2">
        <div className="text-[10px] font-bold text-subtext0 uppercase tracking-wider">
          Technical Specifications
        </div>
        <div className="grid grid-cols-4 gap-2 text-[11px] font-mono">
          <div>
            <span className="text-subtext0/70 block text-[10px]">Isolation</span>
            <span className="text-text font-medium">
              {draftSandboxType === 'in_memory'
                ? 'RAM (None)'
                : draftSandboxType === 'local_worktree'
                  ? 'Worktree'
                  : 'Container'}
            </span>
          </div>
          <div>
            <span className="text-subtext0/70 block text-[10px]">Command Exec</span>
            <span className="text-text font-medium">
              {draftSandboxType === 'in_memory' ? 'No' : 'Supported'}
            </span>
          </div>
          <div>
            <span className="text-subtext0/70 block text-[10px]">Filesystem</span>
            <span className="text-text font-medium">
              {draftSandboxType === 'in_memory' ? 'Read-only' : 'Isolated write'}
            </span>
          </div>
          <div>
            <span className="text-subtext0/70 block text-[10px]">Prerequisites</span>
            <span className="text-text font-medium">
              {draftSandboxType === 'docker' ? 'Docker daemon' : 'Native git'}
            </span>
          </div>
        </div>
      </div>

      {/* Active Instances & Command Execution Section */}
      {committedSandboxType !== 'in_memory' && (
        <div className="p-3.5 bg-surface0/20 border border-surface0 rounded-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-text block">
                Instances ({activeSandboxInstances.length})
              </span>
              <span className="text-[11px] text-subtext0 block">
                Detached environments for {getAdapterName(committedSandboxType)}
              </span>
            </div>

            <button
              type="button"
              onClick={handleCreateInstance}
              disabled={isSandboxLoading}
              className="px-2.5 py-1 rounded-sm bg-surface1 hover:bg-surface2 text-text text-xs border border-surface2 transition-colors cursor-pointer disabled:opacity-50 font-medium"
            >
              + Provision Instance
            </button>
          </div>

          {activeSandboxInstances.length === 0 ? (
            <div className="p-3 border border-dashed border-surface1 rounded-sm text-center text-xs text-subtext0">
              No active sandbox instances provisioned.
            </div>
          ) : (
            <div className="space-y-1.5">
              {activeSandboxInstances.map((inst) => (
                <SandboxInstanceCard
                  key={inst.id}
                  inst={inst}
                  setSelectedInstanceId={setSelectedInstanceId}
                  selectedInstanceId={selectedInstanceId}
                  activeSandboxInstances={activeSandboxInstances}
                  destroySandboxInstance={destroySandboxInstance}
                />
              ))}
            </div>
          )}

          {/* Minimal Terminal Command Runner */}
          {activeSandboxInstances.length > 0 && (
            <div className="pt-2 border-t border-surface0/60 space-y-2">
              <label
                htmlFor="sandbox-command-input"
                className="text-[11px] font-semibold text-text block"
              >
                Execute Command
              </label>

              <div className="flex items-center gap-2">
                <input
                  id="sandbox-command-input"
                  type="text"
                  value={testCmd}
                  onChange={(e) => setTestCmd(e.target.value)}
                  placeholder="e.g. npm test or cargo test"
                  className="flex-1 bg-base border border-surface1 rounded-sm px-3 py-1.5 text-xs font-mono text-text focus:outline-none focus:border-surface2"
                />

                <button
                  type="button"
                  onClick={handleRunCommand}
                  disabled={cmdRunning}
                  className="px-3 py-1.5 rounded-sm bg-surface1 hover:bg-surface2 text-text text-xs font-medium border border-surface2 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {cmdRunning ? 'Running...' : 'Run'}
                </button>
              </div>

              {cmdOutput && (
                <div className="mt-2 bg-crust border border-surface0 rounded-sm p-3 text-xs font-mono space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-subtext0 border-b border-surface0/60 pb-1">
                    <span>Exit code: {cmdOutput.exitCode}</span>
                    <span>{cmdOutput.durationMs}ms</span>
                  </div>
                  {cmdOutput.outputTruncated && (
                    <div className="text-yellow text-[10px]">
                      Output limit reached; the process was stopped. Recreate the Docker sandbox if
                      it was active.
                    </div>
                  )}
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
