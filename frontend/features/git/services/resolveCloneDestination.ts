import { getApplicationServices } from '../../../core/services/runtime/applicationRuntime';

import { isSafeCloneRepoName } from '../utils/cloneDestination';

export async function resolveCloneDestination(parent: string, name: string): Promise<string> {
  const directory = parent.trim();
  if (!directory || !isSafeCloneRepoName(name) || !await getApplicationServices().platform.paths.isAbsolute(directory)) return '';
  return getApplicationServices().platform.paths.join(directory, name);
}
