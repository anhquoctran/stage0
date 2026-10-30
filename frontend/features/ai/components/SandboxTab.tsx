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
        return translateUiText('ai.sandbox.engineNames.inMemory');
      case 'local_worktree':
        return translateUiText('ai.sandbox.engineNames.worktree');
      case 'docker':
        return translateUiText('ai.sandbox.engineNames.docker');
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
      title: translateUiText('ai.sandbox.adapters.inMemoryTitle'),
      defaultBadge: true,
      description:
        translateUiText('ai.sandbox.adapters.inMemoryDescription'),
      specs: translateUiText('ai.sandbox.adapters.inMemorySpecs'),
    },
    {
      id: 'local_worktree',
      title: translateUiText('ai.sandbox.adapters.worktreeTitle'),
      description:
        translateUiText('ai.sandbox.adapters.worktreeDescription'),
      specs: translateUiText('ai.sandbox.adapters.worktreeSpecs'),
    },
    {
      id: 'docker',
      title: translateUiText('ai.sandbox.adapters.dockerTitle'),
      description:
        translateUiText('ai.sandbox.adapters.dockerDescription'),
      specs: translateUiText('ai.sandbox.adapters.dockerSpecs'),
      extraBadge: dockerInfo?.is_available
        ? translateUiText('ai.sandbox.daemonReady')
        : translateUiText('ai.sandbox.daemonOffline'),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-surface0">
        <div>
          <h3 className="text-sm font-bold text-text">{translateUiText('ai.sandbox.title')}</h3>
          <p className="text-[11px] text-subtext0 mt-0.5">
            {translateUiText('ai.sandbox.description')}
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchAvailableSandboxes()}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-sm hover:bg-surface0 text-subtext0 hover:text-text transition-colors cursor-pointer"
          title={translateUiText('ai.sandbox.refreshAvailability')}
        >
          <RotateCw className="w-3 h-3" />
          <span>{translateUiText('ai.sandbox.refresh')}</span>
        </button>
      </div>

      {/* Transaction Notice (if uncommitted) */}
      {isPendingCommit && (
        <div className="px-3 py-2 bg-surface0/50 rounded-sm text-xs flex items-center justify-between text-subtext1">
          <span>
            {translateUiText('ai.sandbox.pendingChange', { name: getAdapterName(draftSandboxType) })}
            {' '}
            {translateUiText('ai.sandbox.applyToCommit', {
              apply: translateUiText('common.apply'),
              ok: translateUiText('common.ok'),
            })}
          </span>
          <span className="text-[10px] text-subtext0 font-mono uppercase">{translateUiText('ai.sandbox.uncommitted')}</span>
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
          {translateUiText('ai.sandbox.technicalSpecifications')}
        </div>
        <div className="grid grid-cols-4 gap-2 text-[11px] font-mono">
          <div>
            <span className="text-subtext0/70 block text-[10px]">{translateUiText('ai.sandbox.isolation')}</span>
            <span className="text-text font-medium">
              {draftSandboxType === 'in_memory'
                ? translateUiText('ai.sandbox.ramNone')
                : draftSandboxType === 'local_worktree'
                  ? translateUiText('ai.sandbox.worktree')
                  : translateUiText('ai.sandbox.container')}
            </span>
          </div>
          <div>
            <span className="text-subtext0/70 block text-[10px]">{translateUiText('ai.sandbox.commandExecution')}</span>
            <span className="text-text font-medium">
              {draftSandboxType === 'in_memory' ? translateUiText('ai.sandbox.no') : translateUiText('ai.sandbox.supported')}
            </span>
          </div>
          <div>
            <span className="text-subtext0/70 block text-[10px]">{translateUiText('ai.sandbox.filesystem')}</span>
            <span className="text-text font-medium">
              {draftSandboxType === 'in_memory' ? translateUiText('ai.sandbox.readOnly') : translateUiText('ai.sandbox.isolatedWrite')}
            </span>
          </div>
          <div>
            <span className="text-subtext0/70 block text-[10px]">{translateUiText('ai.sandbox.prerequisites')}</span>
            <span className="text-text font-medium">
              {draftSandboxType === 'docker' ? translateUiText('ai.sandbox.dockerDaemon') : translateUiText('ai.sandbox.nativeGit')}
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
                {translateUiText('ai.sandbox.instances', { count: activeSandboxInstances.length })}
              </span>
              <span className="text-[11px] text-subtext0 block">
                {translateUiText('ai.sandbox.detachedEnvironments', { name: getAdapterName(committedSandboxType) })}
              </span>
            </div>

            <button
              type="button"
              onClick={handleCreateInstance}
              disabled={isSandboxLoading}
              className="px-2.5 py-1 rounded-sm bg-surface1 hover:bg-surface2 text-text text-xs border border-surface2 transition-colors cursor-pointer disabled:opacity-50 font-medium"
            >
              + {translateUiText('ai.sandbox.provisionInstance')}
            </button>
          </div>

          {activeSandboxInstances.length === 0 ? (
            <div className="p-3 border border-dashed border-surface1 rounded-sm text-center text-xs text-subtext0">
              {translateUiText('ai.sandbox.noInstances')}
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
                {translateUiText('ai.sandbox.executeCommand')}
              </label>

              <div className="flex items-center gap-2">
                <input
                  id="sandbox-command-input"
                  type="text"
                  value={testCmd}
                  onChange={(e) => setTestCmd(e.target.value)}
                  placeholder={translateUiText('ai.sandbox.commandPlaceholder')}
                  className="flex-1 bg-base border border-surface1 rounded-sm px-3 py-1.5 text-xs font-mono text-text focus:outline-none focus:border-surface2"
                />

                <button
                  type="button"
                  onClick={handleRunCommand}
                  disabled={cmdRunning}
                  className="px-3 py-1.5 rounded-sm bg-surface1 hover:bg-surface2 text-text text-xs font-medium border border-surface2 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {cmdRunning ? translateUiText('ai.sandbox.running') : translateUiText('ai.sandbox.run')}
                </button>
              </div>

              {cmdOutput && (
                <div className="mt-2 bg-crust border border-surface0 rounded-sm p-3 text-xs font-mono space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-subtext0 border-b border-surface0/60 pb-1">
                    <span>{translateUiText('ai.sandbox.exitCode', { code: cmdOutput.exitCode })}</span>
                    <span>{translateUiText('ai.sandbox.durationMs', { duration: cmdOutput.durationMs })}</span>
                  </div>
                  {cmdOutput.outputTruncated && (
                    <div className="text-yellow text-[10px]">
                      {translateUiText('ai.sandbox.outputTruncated')}
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
