import type { VirtualMrTitleChange } from '../types/VirtualMrTitleChange';

const STORAGE_PREFIX = 'stage0:mr-title-history:';

export function loadSessionTitleHistory(sessionId: string): VirtualMrTitleChange[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${sessionId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordSessionTitleChange(
  sessionId: string,
  oldTitle: string,
  newTitle: string,
  authorName: string
): VirtualMrTitleChange[] {
  const existing = loadSessionTitleHistory(sessionId);
  const newEntry: VirtualMrTitleChange = {
    id: `title-${sessionId}-${Date.now()}`,
    oldTitle,
    newTitle,
    changedAt: new Date().toISOString(),
    authorName,
  };
  const updated = [...existing, newEntry];
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${sessionId}`, JSON.stringify(updated));
    } catch {}
  }
  return updated;
}

