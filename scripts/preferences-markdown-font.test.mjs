import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWithMocks } from './helpers/componentHarness.mjs';

const { DEFAULT_MARKDOWN_FONT_SETTINGS } = loadWithMocks(
  new URL('../frontend/features/preferences/constants/markdownFonts.ts', import.meta.url),
  {}
);

const { applyMarkdownFontToDocument } = loadWithMocks(
  new URL('../frontend/features/preferences/utils/applyMarkdownFontToDocument.ts', import.meta.url),
  {}
);

const { countUnsavedPreferences } = loadWithMocks(
  new URL('../frontend/features/preferences/utils/countUnsavedPreferences.ts', import.meta.url),
  {}
);

test('DEFAULT_MARKDOWN_FONT_SETTINGS has expected Zed-style defaults', () => {
  assert.equal(DEFAULT_MARKDOWN_FONT_SETTINGS.fontFamily, 'Arial');
  assert.equal(DEFAULT_MARKDOWN_FONT_SETTINGS.codeFontFamily, 'Fira Code');
  assert.equal(DEFAULT_MARKDOWN_FONT_SETTINGS.fontSize, 14);
  assert.equal(DEFAULT_MARKDOWN_FONT_SETTINGS.headingFontWeight, 600);
});

test('applyMarkdownFontToDocument sets CSS custom properties on documentElement', () => {
  const props = new Map();
  const mockDoc = {
    documentElement: {
      style: {
        setProperty: (k, v) => props.set(k, v),
        removeProperty: (k) => props.delete(k),
      },
    },
  };

  globalThis.document = mockDoc;
  try {
    applyMarkdownFontToDocument({
      fontFamily: 'Inter',
      codeFontFamily: 'JetBrains Mono',
      fontSize: 16,
      headingFontWeight: 700,
    });

    assert.ok(props.get('--markdown-font-family').includes('Inter'));
    assert.ok(props.get('--markdown-code-font-family').includes('JetBrains Mono'));
    assert.equal(props.get('--markdown-font-size'), '16px');
    assert.equal(props.get('--markdown-heading-weight'), '700');

    // Removing / empty values
    applyMarkdownFontToDocument({
      fontFamily: '',
      codeFontFamily: '',
      fontSize: 0,
      headingFontWeight: 0,
    });

    assert.equal(props.has('--markdown-font-family'), false);
    assert.equal(props.has('--markdown-code-font-family'), false);
    assert.equal(props.has('--markdown-font-size'), false);
    assert.equal(props.has('--markdown-heading-weight'), false);
  } finally {
    delete globalThis.document;
  }
});

test('countUnsavedPreferences participates in markdown font change detection', () => {
  const baseline = {
    showInlineBlame: true,
    themeMode: 'system',
    fontFamily: 'Fira Code',
    fontSize: 13,
    isBold: false,
    isItalic: false,
    isUnderline: false,
    lineSpacing: 1.5,
    enableLigatures: true,
    sandboxType: 'in_memory',
    gitBinaryId: 'bundled',
    markdownFontFamily: 'Arial',
    markdownCodeFontFamily: 'Fira Code',
    markdownFontSize: 14,
    markdownHeadingWeight: 600,
  };

  const draft = { ...baseline };
  assert.equal(countUnsavedPreferences(draft, baseline, 0), 0);

  // Change font family
  assert.equal(countUnsavedPreferences({ ...draft, markdownFontFamily: 'Inter' }, baseline, 0), 1);

  // Change code font family
  assert.equal(countUnsavedPreferences({ ...draft, markdownCodeFontFamily: 'Hack' }, baseline, 0), 1);

  // Change font size
  assert.equal(countUnsavedPreferences({ ...draft, markdownFontSize: 16 }, baseline, 0), 1);

  // Change heading weight
  assert.equal(countUnsavedPreferences({ ...draft, markdownHeadingWeight: 700 }, baseline, 0), 1);

  // Change all 4
  assert.equal(
    countUnsavedPreferences(
      {
        ...draft,
        markdownFontFamily: 'Inter',
        markdownCodeFontFamily: 'Hack',
        markdownFontSize: 16,
        markdownHeadingWeight: 700,
      },
      baseline,
      0
    ),
    4
  );
});

