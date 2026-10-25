import { homeDir, isAbsolute, join } from '@tauri-apps/api/path';
import type { PathService } from '../../contracts/PathService';

export function createTauriPaths(): PathService {
  return { homeDirectory: () => homeDir(), isAbsolute: path => isAbsolute(path), join: (...parts) => join(...parts) };
}
