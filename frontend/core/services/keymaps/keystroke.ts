const modifiers: Record<string, string> = {
  cmdorctrl: 'CmdOrCtrl', commandorcontrol: 'CmdOrCtrl', mod: 'CmdOrCtrl',
  cmd: 'Cmd', command: 'Cmd', meta: 'Cmd', ctrl: 'Ctrl', control: 'Ctrl',
  alt: 'Alt', option: 'Alt', shift: 'Shift',
};
const names: Record<string, string> = Object.fromEntries([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown',
  'Enter', 'Escape', 'Tab', 'Space', 'Backspace', 'Delete', 'Insert', 'Backquote', 'Equal',
  'Minus', 'BracketLeft', 'BracketRight', 'Backslash', 'Semicolon', 'Quote',
].map((key) => [key.toLowerCase(), key]));
const punctuation: Record<string, string> = {
  ' ': 'Space', '`': 'Backquote', '~': 'Backquote', '+': 'Equal', '=': 'Equal',
  '-': 'Minus', '_': 'Minus', '[': 'BracketLeft', ']': 'BracketRight', '\\': 'Backslash',
  ';': 'Semicolon', "'": 'Quote',
};
export function normalizeStroke(source: string, mac?: boolean): string {
  const parts = source.split('+').map((part) => part.trim());
  const raw = parts.pop() ?? '';
  const key = names[raw.toLowerCase()] ?? ({ slash: '/', comma: ',', period: '.' } as Record<string, string>)[raw.toLowerCase()] ?? punctuation[raw] ?? raw.toUpperCase();
  if (!/^(?:[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4])|[,./])$/.test(key) && !Object.values(names).includes(key))
    throw new Error(`Unsupported key: ${raw || '(empty)'}. Use named keys such as Equal or Space.`);
  const mods = parts.map((part) => modifiers[part.toLowerCase()]);
  if (mods.some((part) => !part) || new Set(mods).size !== mods.length)
    throw new Error('Use each modifier at most once: CmdOrCtrl, Ctrl, Cmd, Alt, Shift.');
  const resolved = mods.map((part) => part === 'CmdOrCtrl' && mac !== undefined ? mac ? 'Cmd' : 'Ctrl' : part);
  if (new Set(resolved).size !== resolved.length || (mods.includes('CmdOrCtrl') && (mods.includes('Ctrl') || mods.includes('Cmd'))))
    throw new Error('CmdOrCtrl cannot be combined with Ctrl or Cmd.');
  return [...['CmdOrCtrl', 'Ctrl', 'Cmd', 'Alt', 'Shift'].filter((part) => resolved.includes(part)), key].join('+');
}
export function normalizeShortcut(source: string, mac?: boolean): string {
  const steps = source.trim().split(/\s+/);
  if (steps.length > 2 || source.length > 128) throw new Error('Use one keystroke or a two-step chord.');
  return steps.map((step) => normalizeStroke(step, mac)).join(' ');
}
export function eventStroke(event: Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>, mac: boolean, portable = false): string | null {
  if (['Control', 'Meta', 'Alt', 'Shift', 'Dead', 'Unidentified', 'AltGraph'].includes(event.key)) return null;
  const mods: string[] = [];
  if (event.ctrlKey) mods.push(portable && !mac && !event.metaKey ? 'CmdOrCtrl' : 'Ctrl');
  if (event.metaKey) mods.push(portable && mac && !event.ctrlKey ? 'CmdOrCtrl' : 'Cmd');
  if (event.altKey) mods.push('Alt');
  if (event.shiftKey) mods.push('Shift');
  let key = punctuation[event.key] ?? event.key;
  // Option may produce a Unicode symbol on macOS; retain its physical shortcut key.
  if (event.altKey && !/^[a-z0-9,./]$/i.test(key)) key = event.code.replace(/^Key|^Digit/, '');
  try { return normalizeStroke([...mods, key].join('+')); }
  catch {
    try { return normalizeStroke([...mods, event.code.replace(/^Key|^Digit/, '')].join('+')); }
    catch { return null; }
  }
}
export function formatKeybinding(keys: string, mac: boolean): string {
  try {
    return normalizeShortcut(keys, mac).split(' ').map((stroke) => stroke.split('+').map((part) =>
      mac ? ({ Cmd: '⌘', Ctrl: '⌃', Alt: '⌥', Shift: '⇧' } as Record<string, string>)[part] ?? part : part
    ).join('+')).join(' ');
  } catch { return keys; }
}
