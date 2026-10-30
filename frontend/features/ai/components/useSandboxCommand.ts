import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SandboxCommandContext } from './SandboxCommandContext';

export function useSandboxCommand({
  currentRepo,
  showToast,
  isPendingCommit,
  createSandboxInstance,
  activeSandboxInstances,
  executeSandboxCommand,
}: SandboxCommandContext) {
  const { t } = useTranslation();
  const [testCmd, setTestCmd] = useState('git status');

  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');

  const [cmdRunning, setCmdRunning] = useState(false);

  const [cmdOutput, setCmdOutput] = useState<{
    stdout: string;
    stderr: string;
    exitCode: number;
    durationMs: number;
    outputTruncated: boolean;
  } | null>(null);

  const handleCreateInstance = async () => {
    if (!currentRepo) {
      showToast(t('ai.sandbox.openRepositoryFirst'));
      return;
    }
    if (isPendingCommit) {
      showToast(
        t('ai.sandbox.commitEngineFirst', {
          apply: t('common.apply'),
          ok: t('common.ok'),
        }),
      );
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
      showToast(t('ai.sandbox.selectInstanceFirst'));
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
          outputTruncated: res.output_truncated,
        });
      }
    } finally {
      setCmdRunning(false);
    }
  };

  return {
    handleCreateInstance,
    setSelectedInstanceId,
    selectedInstanceId,
    testCmd,
    setTestCmd,
    handleRunCommand,
    cmdRunning,
    cmdOutput,
  };
}
