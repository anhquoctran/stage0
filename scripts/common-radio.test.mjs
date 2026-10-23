import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Radio.tsx renders circular rounded-full radio button with inner circular dot', () => {
  const radioSrc = readFileSync(
    new URL('../frontend/common/components/Radio.tsx', import.meta.url),
    'utf-8'
  );
  assert.match(radioSrc, /rounded-full/);
  assert.match(radioSrc, /type="radio"/);
  assert.match(radioSrc, /sr-only/);
  assert.match(radioSrc, /border-brand/);
  assert.match(radioSrc, /scale-100/);
});

test('index.css enforces circular border-radius for input[type="radio"]', () => {
  const cssSrc = readFileSync(
    new URL('../frontend/core/styles/index.css', import.meta.url),
    'utf-8'
  );
  assert.match(cssSrc, /input\[type="radio"\]\s*\{\s*border-radius:\s*9999px\s*!important;\s*\}/);
});

test('SandboxConfigForm uses common circular Radio component instead of square rounded-sm', () => {
  const formSrc = readFileSync(
    new URL('../frontend/features/ai/components/sandbox/SandboxConfigForm.tsx', import.meta.url),
    'utf-8'
  );
  assert.match(formSrc, /import\s*\{\s*Radio\s*\}\s*from/);
  assert.match(formSrc, /<Radio/);
  assert.doesNotMatch(formSrc, /border-4 border-text/);
  assert.doesNotMatch(formSrc, /w-4 h-4 rounded-sm/);
});

test('GitBinaryListTable uses common circular Radio component', () => {
  const tableSrc = readFileSync(
    new URL('../frontend/features/git/components/git-binary/GitBinaryListTable.tsx', import.meta.url),
    'utf-8'
  );
  assert.match(tableSrc, /import\s*\{\s*Radio\s*\}\s*from/);
  assert.match(tableSrc, /<Radio/);
});

test('RepositoryBotInheritanceCards uses common circular Radio component', () => {
  const cardsSrc = readFileSync(
    new URL('../frontend/features/git/components/repository-settings/RepositoryBotInheritanceCards.tsx', import.meta.url),
    'utf-8'
  );
  assert.match(cardsSrc, /import\s*\{\s*Radio\s*\}\s*from/);
  assert.match(cardsSrc, /<Radio/);
});

