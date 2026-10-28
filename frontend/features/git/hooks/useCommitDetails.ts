import { useEffect, useState } from 'react';
import { useApplicationServices } from '../../../core/services/runtime/useApplicationServices';
import type { GitCommitDetails } from '../types/GitCommitDetails';

export function useCommitDetails(repoPath: string, commitHash: string) {
  const { gitHistory } = useApplicationServices();
  const [result, setResult] = useState<{ key: string; data: GitCommitDetails | null; error: string | null } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = `${repoPath}:${commitHash}:${attempt}`;
  useEffect(() => {
    let active = true;
    gitHistory.getGitCommitDetails({ repoPath, commitHash }).then(
      data => { if (active) setResult({ key, data, error: null }); },
      reason => { if (active) setResult({ key, data: null, error: reason instanceof Error ? reason.message : String(reason) }); },
    );
    return () => { active = false; };
  }, [gitHistory, repoPath, commitHash, key]);
  const current = result?.key === key ? result : null;
  return { data: current?.data ?? null, error: current?.error ?? null, loading: !current, retry: () => setAttempt(value => value + 1) };
}
