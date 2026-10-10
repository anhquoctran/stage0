import { isAbsolute, join } from '@tauri-apps/api/path';
import { isSafeCloneRepoName } from '../utils/cloneDestination';

export async function resolveCloneDestination(parent: string, name: string): Promise<string> {
  const directory = parent.trim();
  if (!directory || !isSafeCloneRepoName(name) || !await isAbsolute(directory)) return '';
  return join(directory, name);
}
