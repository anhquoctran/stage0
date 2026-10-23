import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getMarkdownFormattingAtCaret } from '../frontend/common/utils/markdownFormatting.ts';

test('getMarkdownFormattingAtCaret handles empty or null values safely', () => {
  assert.deepEqual(getMarkdownFormattingAtCaret(''), {});
  assert.deepEqual(getMarkdownFormattingAtCaret(null), {});
  assert.deepEqual(getMarkdownFormattingAtCaret(undefined), {});
});

test('detects bold when caret or selection is inside **bold** or __bold__', () => {
  const text = 'Hello **world** and __there__!';

  // Offset 10 is the letter 'r' inside **world**
  const rInsideBold = getMarkdownFormattingAtCaret(text, 10, 10);
  assert.equal(rInsideBold.bold, true);
  assert.equal(rInsideBold.italic, false);

  // Offset 24 is inside __there__
  const thereInsideBold = getMarkdownFormattingAtCaret(text, 24, 24);
  assert.equal(thereInsideBold.bold, true);

  // Offset 2 is outside in 'Hello'
  const outside = getMarkdownFormattingAtCaret(text, 2, 2);
  assert.equal(outside.bold, false);
});

test('detects italic when caret is inside *italic* or _italic_', () => {
  const text = 'Hello *world* and _there_!';

  const rInsideItalic = getMarkdownFormattingAtCaret(text, 9, 9);
  assert.equal(rInsideItalic.italic, true);
  assert.equal(rInsideItalic.bold, false);

  const thereInsideItalic = getMarkdownFormattingAtCaret(text, 21, 21);
  assert.equal(thereInsideItalic.italic, true);
});

test('detects strikethrough when caret is inside ~~strike~~', () => {
  const text = 'This is ~~obsolete~~ text';

  const insideStrike = getMarkdownFormattingAtCaret(text, 12, 12);
  assert.equal(insideStrike.strike, true);

  const outside = getMarkdownFormattingAtCaret(text, 2, 2);
  assert.equal(outside.strike, false);
});

test('detects inline code when caret is inside backticks', () => {
  const text = 'Call `getUserProfile(id)` to fetch';

  const insideCode = getMarkdownFormattingAtCaret(text, 12, 12);
  assert.equal(insideCode.code, true);

  const outside = getMarkdownFormattingAtCaret(text, 2, 2);
  assert.equal(outside.code, false);
});

test('detects link when caret is inside markdown link syntax', () => {
  const text = 'Read the [API Documentation](https://example.com/docs)';

  const insideLinkText = getMarkdownFormattingAtCaret(text, 15, 15);
  assert.equal(insideLinkText.link, true);

  const insideLinkUrl = getMarkdownFormattingAtCaret(text, 35, 35);
  assert.equal(insideLinkUrl.link, true);

  const outside = getMarkdownFormattingAtCaret(text, 2, 2);
  assert.equal(outside.link, false);
});

test('detects heading, quote, lists, task items and tables', () => {
  const doc = [
    '### Section Heading',
    '> Important quote',
    '- Bullet item',
    '1. Numbered item',
    '- [ ] Unchecked task',
    '| Col A | Col B |',
  ].join('\n');

  // Heading
  const headingPos = 5;
  assert.equal(getMarkdownFormattingAtCaret(doc, headingPos, headingPos).heading, true);

  // Quote
  const quotePos = doc.indexOf('Important');
  assert.equal(getMarkdownFormattingAtCaret(doc, quotePos, quotePos).quote, true);

  // Bullet list
  const bulletPos = doc.indexOf('Bullet');
  assert.equal(getMarkdownFormattingAtCaret(doc, bulletPos, bulletPos).bulletList, true);

  // Numbered list
  const numberPos = doc.indexOf('Numbered');
  assert.equal(getMarkdownFormattingAtCaret(doc, numberPos, numberPos).numberList, true);

  // Task list
  const taskPos = doc.indexOf('Unchecked');
  assert.equal(getMarkdownFormattingAtCaret(doc, taskPos, taskPos).taskList, true);

  // Table
  const tablePos = doc.indexOf('Col A');
  assert.equal(getMarkdownFormattingAtCaret(doc, tablePos, tablePos).table, true);
});

test('detects fenced code blocks and suggestion blocks', () => {
  const doc = [
    'Normal text',
    '```typescript',
    'interface Foo {',
    '  id: string;',
    '}',
    '```',
    'More text',
    '```suggestion',
    'const x = 1;',
    '```',
  ].join('\n');

  const insideCodeBlock = doc.indexOf('id: string');
  const codeBlockFormats = getMarkdownFormattingAtCaret(doc, insideCodeBlock, insideCodeBlock);
  assert.equal(codeBlockFormats.codeBlock, true);
  assert.equal(codeBlockFormats.suggestion, false);

  const insideSuggestion = doc.indexOf('const x');
  const suggestionFormats = getMarkdownFormattingAtCaret(doc, insideSuggestion, insideSuggestion);
  assert.equal(suggestionFormats.suggestion, true);

  const normalPos = 2;
  const normalFormats = getMarkdownFormattingAtCaret(doc, normalPos, normalPos);
  assert.equal(normalFormats.codeBlock, false);
  assert.equal(normalFormats.suggestion, false);
});

test('MarkdownToolbar and MarkdownEditor wire activeFormats to buttons', () => {
  const toolbarSource = readFileSync(
    new URL('../frontend/common/components/markdown-editor/MarkdownToolbar.tsx', import.meta.url),
    'utf-8'
  );
  const editorSource = readFileSync(
    new URL('../frontend/common/components/MarkdownEditor.tsx', import.meta.url),
    'utf-8'
  );

  // Toolbar checks activeFormats for each button and applies active styling
  assert.match(toolbarSource, /activeFormats\?\.bold/);
  assert.match(toolbarSource, /activeFormats\?\.italic/);
  assert.match(toolbarSource, /activeFormats\?\.strike/);
  assert.match(toolbarSource, /activeFormats\?\.heading/);
  assert.match(toolbarSource, /activeFormats\?\.code/);
  assert.match(toolbarSource, /activeFormats\?\.link/);
  assert.match(toolbarSource, /activeFormats\?\.bulletList/);
  assert.match(toolbarSource, /activeFormats\?\.taskList/);
  assert.match(toolbarSource, /activeFormats\?\.quote/);
  assert.match(toolbarSource, /bg-surface2 text-accent/);

  // Editor computes activeFormats via getMarkdownFormattingAtCaret
  assert.match(editorSource, /getMarkdownFormattingAtCaret/);
  assert.match(editorSource, /activeFormats={activeFormats}/);
  assert.match(editorSource, /selectionRange/);
});

