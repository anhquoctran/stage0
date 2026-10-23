import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import hljs from 'highlight.js';
import { Marked } from 'marked';

test('highlight.js supports typescript and rust syntax tokens', () => {
  const tsCode = `interface SessionPayload {\n  readonly id: string;\n  status: 'open' | 'merged';\n}`;
  const highlightedTs = hljs.highlight(tsCode, { language: 'typescript' }).value;

  assert.ok(highlightedTs.includes('hljs-keyword'), 'TypeScript output should contain keyword token');
  assert.ok(highlightedTs.includes('hljs-title class_'), 'TypeScript output should contain class/interface title token');
  assert.ok(highlightedTs.includes('hljs-string'), 'TypeScript output should contain string token');

  const rustCode = `use serde::{Deserialize, Serialize};\n#[derive(Debug, Clone)]\npub struct GitCommitItem {\n  pub hash: String,\n}`;
  const highlightedRust = hljs.highlight(rustCode, { language: 'rust' }).value;

  assert.ok(highlightedRust.includes('hljs-keyword'), 'Rust output should contain keyword token');
  assert.ok(highlightedRust.includes('hljs-title class_'), 'Rust output should contain struct title token');
});

test('MarkdownPreview component configures Marked with syntax highlighting code renderer', () => {
  const previewSource = readFileSync(
    new URL('../frontend/common/components/MarkdownPreview.tsx', import.meta.url),
    'utf-8'
  );

  assert.match(previewSource, /import hljs from 'highlight\.js'/);
  assert.match(previewSource, /hljs\.highlight\(/);
  assert.match(previewSource, /hljs\.highlightAuto\(/);
  assert.match(previewSource, /hljs\${langClass}/);
});

test('index.css includes Catppuccin syntax highlighting for .markdown-preview', () => {
  const cssSource = readFileSync(
    new URL('../frontend/core/styles/index.css', import.meta.url),
    'utf-8'
  );

  assert.match(cssSource, /\.markdown-preview\s+\.hljs/);
  assert.match(cssSource, /\.markdown-preview\s+\.hljs-keyword/);
  assert.match(cssSource, /\.markdown-preview\s+\.hljs-title/);
  assert.match(cssSource, /\.markdown-preview\s+\.hljs-string/);
  assert.match(cssSource, /\.markdown-preview\s+\.hljs-number/);
  assert.match(cssSource, /\.markdown-preview\s+\.hljs-built_in/);
  assert.match(cssSource, /\.markdown-preview\s+\.hljs-comment/);
});
