import type { MentionOption } from '../types/MentionOption';

export function formatMention(option: MentionOption): string {
  const label = option.label.replace(/[\\`*_{}\[\]<>!|]/g, '\\$&').replace(/[\r\n]+/g, ' ');
  return `[@${label}](#mr-mention/${option.kind}/${encodeURIComponent(option.id)})`;
}

export function parseMentionReference(href: string): Pick<MentionOption, 'id' | 'kind'> | null {
  const match = /^#mr-mention\/(reviewer|assignee)\/(.+)$/.exec(href);
  if (!match) return null;
  try { return { kind: match[1] as MentionOption['kind'], id: decodeURIComponent(match[2]) }; }
  catch { return null; }
}

export function getMentionQuery(value: string, caret: number) {
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
  const match = /(?:^|[\s(])@([\p{L}\p{N}_.-]*)$/u.exec(before);
  if (!match) return null;
  const start = caret - match[1].length - 1;
  const tail = /^[\p{L}\p{N}_.-]*/u.exec(value.slice(caret))?.[0] ?? '';
  return { start, end: caret + tail.length, query: match[1].toLocaleLowerCase() };
}
