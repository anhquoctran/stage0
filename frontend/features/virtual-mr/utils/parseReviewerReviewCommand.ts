import { parseMentionReference } from '../../../common/utils/mentions';

/** Exact root command: one or more reviewer tokens separated by spaces, then review. */
export function parseReviewerReviewCommands(body: string): string[] {
  const command = body.trim();
  const suffix = /[ \t]+review$/iu.exec(command);
  if (!suffix || /[\r\n]/u.test(command)) return [];
  const mentions = command.slice(0, suffix.index);
  const token = /\[@(?:\\[^\r\n]|[^\\[\]\r\n])+\]\((#mr-mention\/reviewer\/[^()\s]+)\)/uy;
  const ids = new Set<string>();
  let offset = 0;
  while (offset < mentions.length) {
    token.lastIndex = offset;
    const match = token.exec(mentions);
    if (!match || /[\x00-\x1f\x7f]/u.test(match[0]) || /[^\x20-\x7e]/u.test(match[1])) return [];
    const reference = parseMentionReference(match[1]);
    if (!reference?.id || /[\x00-\x1f\x7f]/u.test(reference.id)) return [];
    ids.add(reference.id);
    offset = token.lastIndex;
    if (offset < mentions.length) {
      const gap = /^[ \t]+/u.exec(mentions.slice(offset));
      if (!gap) return [];
      offset += gap[0].length;
      if (offset === mentions.length) return [];
    }
  }
  return [...ids];
}

/** Retains the single-reviewer parser contract for existing callers. */
export function parseReviewerReviewCommand(body: string): string | null {
  const ids = parseReviewerReviewCommands(body);
  return ids.length === 1 ? ids[0] : null;
}
