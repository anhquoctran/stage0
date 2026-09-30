const shortcutSequence =
  /\b(?:CmdOrCtrl|Command|Control|Ctrl|Cmd|Option|Alt|Shift)(?:\+(?:CmdOrCtrl|Command|Control|Ctrl|Cmd|Option|Alt|Shift))*\+(?:[A-Z0-9]+|[,./])/gi;

const macModifierSymbols: Record<string, string> = {
  cmdorctrl: '⌘',
  command: '⌘',
  cmd: '⌘',
  ctrl: '⌘',
  control: '⌃',
  option: '⌥',
  alt: '⌥',
  shift: '⇧',
};

export const isMacOS = (): boolean =>
  typeof navigator !== 'undefined' &&
  /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export const formatShortcutText = (text: string, mac = isMacOS()): string => {
  if (!mac) return text;

  return text.replace(shortcutSequence, (sequence) =>
    sequence
      .split('+')
      .map((part) => macModifierSymbols[part.toLowerCase()] ?? part)
      .join(' + '),
  );
};
