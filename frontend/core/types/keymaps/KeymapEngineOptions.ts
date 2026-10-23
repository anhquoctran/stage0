import type { KeymapCommand } from './KeymapCommand';
import type { KeymapContext } from './KeymapContext';

export interface KeymapEngineOptions {
  mac: boolean;
  getCommands: () => KeymapCommand[];
  getContext: (event: KeyboardEvent) => KeymapContext;
  execute: (id: string) => void;
  nativeOwns?: (id: string, key: string) => boolean;
  onChord?: (key: string | null) => void;
  timeoutMs?: number;
}
