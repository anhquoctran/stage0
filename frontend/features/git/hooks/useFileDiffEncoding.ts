import { useEffect, useState } from 'react';
import { useApplicationServices } from '../../../core/services/runtime/useApplicationServices';
import { useFileEncodingStore } from '../store/useFileEncodingStore';
import type { FileTextDiff } from '../types/FileTextDiff';

export function useFileDiffEncoding(repoPath: string, oldRef: string | null, newRef: string, filePath: string, oldPath?: string) {
  const { gitFiles } = useApplicationServices();
  const fileKey = JSON.stringify([repoPath, filePath]);
  const encoding = useFileEncodingStore(state => state.selections[fileKey] ?? null);
  const setEncoding = useFileEncodingStore(state => state.setEncoding);
  const manual = Boolean(encoding);
  const key = JSON.stringify([repoPath, oldRef, newRef, filePath, oldPath, encoding]);
  const [result, setResult] = useState<{ key: string; data: FileTextDiff | null; error: string | null } | null>(null);
  useEffect(() => {
    if (!manual || !repoPath || !filePath || !newRef) return;
    let active = true;
    gitFiles.getFileTextDiff({ repoPath, oldRef, newRef, filePath, oldPath: oldPath ?? null, encoding }).then(
      data => { if (active) setResult({ key, data, error: null }); },
      reason => { if (active) setResult({ key, data: null, error: reason instanceof Error ? reason.message : String(reason) }); },
    );
    return () => { active = false; };
  }, [gitFiles, key, manual, repoPath, oldRef, newRef, filePath, oldPath, encoding]);
  const current = manual && result?.key === key ? result : null;
  return { encoding, manual, data: current?.data ?? null, error: current?.error ?? null,
    loading: manual && !current,
    setEncoding: (encoding: string | null) => setEncoding(fileKey, encoding) };
}
