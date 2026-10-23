import type { KeymapCommand } from '../../types/keymaps/KeymapCommand';
import type { KeymapContext } from '../../types/keymaps/KeymapContext';
import type { KeymapEngineOptions } from '../../types/keymaps/KeymapEngineOptions';
import { eventStroke, normalizeShortcut } from './keystroke';

export function commandActive(command: KeymapCommand, context: KeymapContext, key: string): boolean {
  if (!command.editable || context.blocked) return false;
  if (command.requires.some((flag) => !context.flags[flag])) return false;
  if (command.scope === 'welcome' && context.repository) return false;
  if (['workspace', 'tabs'].includes(command.scope) && !context.repository) return false;
  if (command.scope === 'workspace' && context.editable) return false;
  if (context.editable && key.includes(' ')) return false;
  // Bare keys and navigation never steal input, button, dropdown or menu handling.
  if ((!key.split(' ')[0].includes('+') || key.startsWith('Shift+')) && (context.editable || context.interactive)) return false;
  return true;
}

export function createKeymapEngine(options: KeymapEngineOptions) {
  let pending: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    if (pending) options.onChord?.(null);
    pending = null;
  };
  const handle = (event: KeyboardEvent): boolean => {
    if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.getModifierState?.('AltGraph')) {
      cancel();
      return false;
    }
    const context = options.getContext(event);
    if (context.blocked) { cancel(); return false; }
    if (event.repeat && pending) return false;
    if (pending && event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      cancel();
      return true;
    }
    const stroke = eventStroke(event, options.mac);
    if (!stroke) return false; // Modifier keydown events between chord steps are harmless.
    const commands = options.getCommands().flatMap((command) => command.keys.map((key) => ({ command, key: normalizeShortcut(key, options.mac) })))
      .filter(({ command, key }) => commandActive(command, context, key) &&
        (!event.repeat || (command.repeatable && !key.includes(' '))));
    if (pending) {
      const match = commands.find(({ key }) => key === `${pending} ${stroke}`);
      cancel();
      if (!match) return false;
      event.preventDefault();
      options.execute(match.command.id);
      return true;
    }
    const candidates = commands.filter(({ key }) => key === stroke || key.startsWith(`${stroke} `));
    if (!candidates.length) return false;
    const exact = candidates.find(({ key }) => key === stroke);
    if (exact) {
      if (options.nativeOwns?.(exact.command.id, exact.key)) return false;
      event.preventDefault();
      options.execute(exact.command.id);
      return true;
    }
    pending = stroke;
    options.onChord?.(pending);
    timer = setTimeout(cancel, options.timeoutMs ?? 1500);
    event.preventDefault();
    return true;
  };
  return { handle, cancel, dispose: cancel };
}
