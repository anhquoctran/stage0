import type { VirtualMrSession } from '../types/VirtualMrSession';

/**
 * Builds a Map of MR sessionId to sequential 1-based index (!1, !2, ...)
 * based on repository creation order (createdAt ascending, then id).
 */
export function buildMrSequenceMap(sessions: VirtualMrSession[]): Map<string, number> {
  const sorted = [...sessions].sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime() || 0;
    const timeB = new Date(b.createdAt).getTime() || 0;
    return timeA - timeB || a.id.localeCompare(b.id);
  });
  const map = new Map<string, number>();
  sorted.forEach((session, index) => {
    map.set(session.id, index + 1);
  });
  return map;
}

/**
 * Returns the 1-based sequence number (!1, !2, ...) of a specific Virtual MR session
 * ordered by repository creation date ascending.
 */
export function getMrSequenceNumber(sessions: VirtualMrSession[], sessionId: string): number {
  const sorted = [...sessions].sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime() || 0;
    const timeB = new Date(b.createdAt).getTime() || 0;
    return timeA - timeB || a.id.localeCompare(b.id);
  });
  const index = sorted.findIndex((session) => session.id === sessionId);
  return index >= 0 ? index + 1 : 1;
}

/**
 * Formats the friendly ID string for an MR (e.g. "!1", "!2").
 */
export function formatMrFriendlyId(sequenceNumber: number): string {
  return `!${sequenceNumber}`;
}

