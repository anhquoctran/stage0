import { parseMentionReference } from '../../../common/utils/mentions';

/** Recognizes the exact Markdown command created by mentioning a bot and typing "review". */
export function parseReviewerReviewCommand(body: string): string | null {
  const match = /^\[@(?:\\.|[^\\\]\r\n])+\]\((#mr-mention\/reviewer\/[^)\s]+)\)[ \t]+review$/iu.exec(body.trim());
  if (!match) return null;
  return parseMentionReference(match[1])?.id ?? null;
}
