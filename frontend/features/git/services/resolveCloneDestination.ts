import { isAbsolute, join } from '../../../common/services/ipc/ipcPath';
import { isSafeCloneRepoName } from '../utils/cloneDestination';

export async function resolveCloneDestination(parent: string, name: string): Promise<string> {
  const directory = parent.trim();
  if (!directory || !isSafeCloneRepoName(name) || !await isAbsolute(directory)) return '';
  return join(directory, name);
}
