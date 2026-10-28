import type { VirtualMrSession } from '../types/VirtualMrSession';

/** Replace old local placeholders without relabeling another named author. */
export function resolveLocalAuthor(
  name?: string | null,
  email?: string | null,
  fallback?: VirtualMrSession['assignee'],
): VirtualMrSession['assignee'] {
  const trimmedEmail = email?.trim();
  const realEmail = trimmedEmail && trimmedEmail !== 'user@local.stage0' ? trimmedEmail : undefined;
  const resolvedEmail = realEmail || fallback?.email || 'user@local.stage0';
  const trimmedName = name?.trim();
  const realName = trimmedName && trimmedName !== 'Local User' ? trimmedName : undefined;
  const sameLocalUser = !realEmail || realEmail === fallback?.email;
  const fallbackName = sameLocalUser && fallback?.name !== 'Local User' ? fallback?.name : undefined;
  return {
    name: realName || fallbackName || (resolvedEmail !== 'user@local.stage0' ? resolvedEmail.split('@')[0] : '') || 'Local User',
    email: resolvedEmail,
  };
}
