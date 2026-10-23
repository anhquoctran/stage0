import type { MarkdownActiveFormats } from '../types/MarkdownActiveFormats';

/**
 * Inspects a markdown document and determines active formatting styles
 * based on the caret position (or selection range).
 */
export function getMarkdownFormattingAtCaret(
  text: string,
  selectionStart?: number,
  selectionEnd?: number
): MarkdownActiveFormats {
  if (typeof text !== 'string' || !text.length) {
    return {};
  }

  const posStart = Math.min(Math.max(0, selectionStart ?? 0), text.length);
  const posEnd = Math.min(Math.max(0, selectionEnd ?? posStart), text.length);

  // Line boundaries for the selection
  const lineStart = text.lastIndexOf('\n', Math.max(0, posStart - 1)) + 1;
  let lineEnd = text.indexOf('\n', posEnd);
  if (lineEnd === -1) lineEnd = text.length;

  const currentLine = text.slice(lineStart, lineEnd);
  const colStart = posStart - lineStart;
  const colEnd = posEnd - lineStart;

  // Check code blocks and suggestion blocks
  let inCodeBlock = false;
  let inSuggestion = false;
  const lines = text.split('\n');
  let lineOffset = 0;

  for (const line of lines) {
    const nextOffset = lineOffset + line.length + 1;
    const isSugFence = /^\s*```suggestion\b/.test(line);
    const isFence = /^\s*```/.test(line);
    const isCursorLine = posStart >= lineOffset && posStart < nextOffset;

    if (isFence) {
      if (isSugFence) {
        if (isCursorLine) {
          inSuggestion = true;
          break;
        }
        inSuggestion = !inSuggestion;
      } else {
        if (isCursorLine) {
          inCodeBlock = true;
          break;
        }
        inCodeBlock = !inCodeBlock;
      }
    } else if (isCursorLine) {
      break;
    }

    lineOffset = nextOffset;
  }

  const formats: MarkdownActiveFormats = {
    heading: /^\s*#{1,6}\s+/.test(currentLine),
    quote: /^\s*>\s*/.test(currentLine),
    taskList: /^\s*[-*+]\s+\[([ xX])\]\s*/.test(currentLine),
    bulletList: /^\s*[-*+]\s+(?!\[[ xX]\])/.test(currentLine),
    numberList: /^\s*\d+\.\s+/.test(currentLine),
    table: /^\s*\|.*\|\s*$/.test(currentLine),
    codeBlock: inCodeBlock,
    suggestion: inSuggestion,
  };

  // Helper for inline spans
  const testSpan = (regex: RegExp): boolean => {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(currentLine)) !== null) {
      const matchStart = match.index;
      const matchEnd = matchStart + match[0].length;
      if (colStart >= matchStart && colEnd <= matchEnd) {
        return true;
      }
    }
    return false;
  };

  formats.bold = testSpan(/(\*\*|__)(?!\s)(?:(?!\1).)+?(?<!\s)\1/g);
  formats.italic = testSpan(
    /(?<!\*)\*(?!\s|\*)(?:[^*])+?(?<!\s|\*)\*(?!\*)|(?<!_)_(?!\s|_)(?:[^_])+?(?<!\s|_)\_(?!_)/g
  );
  formats.strike = testSpan(/~~(?!\s)(?:(?!~~).)+?(?<!\s)~~/g);
  formats.code = !inCodeBlock && testSpan(/`[^`\n]+`/g);
  formats.link = testSpan(/\[[^\]]+\]\([^)]+\)|\[[^\]]+\]\[[^\]]+\]/g);

  return formats;
}

