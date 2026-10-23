import { MENU_COMMANDS } from '../../constants/applicationMenu';
import type { KeymapCommand } from '../../types/keymaps/KeymapCommand';
import { normalizeShortcut } from './keystroke';

export function nativeKeymapAccelerators(commands: KeymapCommand[], blocked = false): Record<string, string> {
  if (blocked) return {};
  return Object.fromEntries(commands.filter((command) => command.editable && Object.hasOwn(MENU_COMMANDS, command.id))
    .flatMap((command) => {
      // Workspace keys stay in the WebView so input/context protections apply.
      // Native menus own only modified application-level single strokes.
      if (command.scope !== 'application') return [];
      const key = command.keys.find((value) => !value.includes(' ') && value.includes('+'));
      return key ? [[command.id, normalizeShortcut(key, true)]] : [];
    }));
}
