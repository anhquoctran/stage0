import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWithMocks } from './helpers/componentHarness.mjs';

const { highlightJsoncLine } = loadWithMocks(
  new URL('../frontend/features/preferences/utils/highlightJsoncLine.ts', import.meta.url),
  {},
);
const { getPreferencesJsonCompletions, hidePreferencesSchemaProperty } = loadWithMocks(
  new URL('../frontend/features/preferences/utils/preferencesJsonCompletions.ts', import.meta.url),
  {},
);

test('JSONC highlighting preserves source text and colors keys, values, literals, numbers and comments', () => {
  const line = '"name": "Stage0", "count": 12, "enabled": true, // note';
  const { segments, continuesBlockComment } = highlightJsoncLine(line, false);
  assert.equal(segments.map((segment) => segment.value).join(''), line);
  assert.equal(continuesBlockComment, false);
  assert.ok(segments.some((segment) => segment.value === '"name"' && segment.className === 'text-blue'));
  assert.ok(segments.some((segment) => segment.value === '"Stage0"' && segment.className === 'text-green'));
  assert.ok(segments.some((segment) => segment.value === '12' && segment.className === 'text-peach'));
  assert.ok(segments.some((segment) => segment.value === 'true' && segment.className === 'text-mauve'));
  assert.ok(segments.some((segment) => segment.value === '// note' && segment.className.includes('italic')));
});

test('JSONC highlighting carries block-comment state across lines and resumes tokenizing afterward', () => {
  const first = highlightJsoncLine('{ /* block comment', false);
  assert.equal(first.continuesBlockComment, true);
  const secondLine = 'still comment */ "ok": false';
  const second = highlightJsoncLine(secondLine, first.continuesBlockComment);
  assert.equal(second.continuesBlockComment, false);
  assert.equal(second.segments.map((segment) => segment.value).join(''), secondLine);
  assert.ok(second.segments.some((segment) => segment.value.includes('still comment */') && segment.className.includes('italic')));
  assert.ok(second.segments.some((segment) => segment.value === '"ok"' && segment.className === 'text-blue'));
  assert.ok(second.segments.some((segment) => segment.value === 'false' && segment.className === 'text-mauve'));
});

test('JSONC completion suggests only missing keys for the current object and inserts a property scaffold', () => {
  const source = '{\n  "general": {\n    "showInlineBlame": true,\n    "streamR';
  const completion = getPreferencesJsonCompletions(source, source.length);
  assert.equal(completion.kind, 'key');
  assert.deepEqual(completion.path, ['general']);
  assert.deepEqual(completion.items.map((item) => item.label), ['streamResponse']);
  assert.equal(completion.items[0].insertText, '"streamResponse": ');
});

test('JSONC completion offers schema-backed enums and literals without suggesting credential fields', () => {
  const enumSource = '{"appearance":{"themeMode":"s';
  const enumCompletion = getPreferencesJsonCompletions(enumSource, enumSource.length);
  assert.deepEqual(enumCompletion.items.map((item) => item.label), ['system']);
  assert.equal(enumCompletion.items[0].insertText, '"system"');

  const booleanSource = '{"general":{"showInlineBlame":tr';
  assert.deepEqual(getPreferencesJsonCompletions(booleanSource, booleanSource.length).items.map((item) => item.label), ['true']);

  const aiSource = '{"ai":{"aiConfig":{';
  const aiCompletion = getPreferencesJsonCompletions(aiSource, aiSource.length, true);
  assert.ok(aiCompletion.items.some((item) => item.label === 'provider'));
  assert.ok(!aiCompletion.items.some((item) => item.label === 'apiKey' || /secretValue|tokenValue/i.test(item.label)));
});

test('JSON Schema metadata is hidden from the editable buffer while nested user keys remain untouched', () => {
  const source = '{\n  "$schema": "https://stage0.app/schemas/preferences-v1.json",\n  "schemaVersion": 1,\n  "custom": { "$schema": "user-data" }\n}';
  const hidden = hidePreferencesSchemaProperty(source);
  assert.doesNotMatch(hidden, /stage0\.app\/schemas/);
  assert.match(hidden, /"schemaVersion": 1/);
  assert.match(hidden, /"\$schema": "user-data"/);
});

test('JSONC completion includes Markdown editor fonts and preview settings', () => {
  const source = '{"appearance":{"markdownFont":{';
  const completion = getPreferencesJsonCompletions(source, source.length, true);
  assert.deepEqual(completion.items.map((item) => item.label).sort(),
    ['fontFamily', 'codeFontFamily', 'editorFontFamily', 'fontSize', 'headingFontWeight'].sort());
  const font = '{"appearance":{"markdownFont":{"editorFontFamily":"Fir';
  assert.deepEqual(getPreferencesJsonCompletions(font, font.length).items.map((item) => item.label), ['Fira Code']);
});
