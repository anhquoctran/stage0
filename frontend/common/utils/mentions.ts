import type { MentionOption } from '../types/MentionOption';

export function formatMention(option: MentionOption, trigger?: '!' | '#'): string {
  const display = option.insertLabel ?? (trigger === '!' && option.kind === 'mr' ? `!${option.id.slice(0, 8)}`
    : trigger === '#' && option.kind === 'commit' ? `#${option.id.slice(0, 8)}` : option.label);
  const label = display.replace(/[\\`*_{}\[\]<>!|]/g, '\\$&').replace(/[\r\n]+/g, ' ');
  const prefix = option.kind === 'reviewer' || option.kind === 'assignee' ? '@' : '';
  return `[${prefix}${label}](#mr-mention/${option.kind}/${encodeURIComponent(option.id)})`;
}

export function parseMentionReference(href: string): Pick<MentionOption, 'id' | 'kind'> | null {
  const match = /^#mr-mention\/(reviewer|assignee|mr|commit)\/(.+)$/.exec(href);
  if (!match) return null;
  try {
    const id = decodeURIComponent(match[2]);
    if (match[1] === 'commit' && !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(id)) return null;
    if (match[1] === 'mr' && (!id || id.length > 128 || /[\s/\\#?\x00-\x1f]/.test(id))) return null;
    return { kind: match[1] as MentionOption['kind'], id };
  }
  catch { return null; }
}

export function getMentionQuery(value: string, caret: number): {
  start: number; end: number; query: string; trigger?: '!' | '#';
} | null {
  const before = value.slice(0, caret);
  let fence: string | null = null;
  let inlineTicks = 0;
  for (const line of before.split('\n')) {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker) {
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null;
      continue;
    }
    if (fence) continue;
    for (const ticks of line.matchAll(/(?<!\\)`+/g)) {
      if (!inlineTicks) inlineTicks = ticks[0].length;
      else if (ticks[0].length === inlineTicks) inlineTicks = 0;
    }
  }
  const currentLine = before.slice(before.lastIndexOf('\n') + 1);
  if (fence || inlineTicks || /^\s*>/.test(currentLine) || /^(?: {4}|\t)/.test(currentLine)) return null;
  const literalLine = currentLine.replace(/\\./g, '');
  if (literalLine.lastIndexOf('[') > literalLine.lastIndexOf(']')
    || /\]\([^)]*$/.test(literalLine)) return null;
  const match = /(?:^|[\s(])([@!#])([\p{L}\p{N}_.-]*)$/u.exec(before);
  if (!match) return null;
  const trigger = match[1] as '@' | '!' | '#';
  if (trigger === '#' && !/^[a-f0-9]{0,64}$/i.test(match[2])) return null;
  const start = caret - match[2].length - 1;
  const tail = /^[\p{L}\p{N}_.-]*/u.exec(value.slice(caret))?.[0] ?? '';
  const query = { start, end: caret + tail.length, query: match[2].toLocaleLowerCase() };
  return trigger === '@' ? query : { ...query, trigger };
}
