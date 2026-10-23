import { usePreferencesStore } from '../../features/preferences/store/usePreferencesStore';
import { useMemo } from 'react';
import { keymapPlatform, resolveKeymap } from '../services/keymaps/catalog';
import { formatKeybinding } from '../services/keymaps/keystroke';

export function useCommandShortcut() {
  const keymap = usePreferencesStore((state) => state.keymap);
  const platform = keymapPlatform();
  const commands = useMemo(() => resolveKeymap(keymap, platform), [keymap, platform]);
  const shortcut = (id: string) => {
    const key = commands.find((command) => command.id === id)?.keys[0];
    return key ? formatKeybinding(key, platform === 'macos') : '';
  };
  return {
    shortcut,
    title: (id: string, label: string) => {
      const keys = shortcut(id);
      return keys ? `${label} (${keys})` : label;
    },
  };
}
