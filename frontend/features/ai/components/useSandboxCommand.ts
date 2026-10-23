import { useState } from 'react';
import type { SandboxCommandContext } from './SandboxCommandContext';

export function useSandboxCommand({
  currentRepo,
  showToast,
  isPendingCommit,
  createSandboxInstance,
  activeSandboxInstances,
  executeSandboxCommand,
}: SandboxCommandContext) {
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
      showToast('Please open a repository first');
      return;
    }
    if (isPendingCommit) {
      showToast('Click Apply or OK to commit the new engine before provisioning instances');
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
