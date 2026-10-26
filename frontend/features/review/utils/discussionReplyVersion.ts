import type { VirtualMrComment } from '../../virtual-mr/types/VirtualMrComment';

/** Deduplication only; authorization uses the backend's full-thread revision. */
export async function discussionReplyVersion(comment: VirtualMrComment): Promise<string | null> {
  try {
    if (!globalThis.crypto?.subtle) return null;
    const bytes = new TextEncoder().encode(JSON.stringify([comment.id, comment.updatedAt, comment.body]));
    const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
  } catch {
    // Unavailable hashing disables caching rather than suppressing a reply.
    return null;
  }
}
