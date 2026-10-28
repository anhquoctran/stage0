import { getApplicationServices } from '../../../core/services/runtime/applicationRuntime';
import type { VirtualMrSession } from '../types/VirtualMrSession';
import { resolveLocalAuthor } from '../utils/localAuthorIdentity';

export async function loadLocalGitAuthor(repoPath: string, fallback?: VirtualMrSession['assignee']) {
  try {
    const [name, email] = await getApplicationServices().gitHistory.getGitUserIdentityCmd({ repoPath });
    return resolveLocalAuthor(name, email, fallback);
  } catch {
    return resolveLocalAuthor(fallback?.name, fallback?.email);
  }
}
