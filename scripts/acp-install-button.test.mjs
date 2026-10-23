import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('AcpAgentCard renders Install button with solid purple background, white text, and no border', () => {
  const cardSrc = readFileSync(
    new URL('../frontend/features/ai/components/external-agents/AcpAgentCard.tsx', import.meta.url),
    'utf-8'
  );

  assert.match(cardSrc, /bg-purple-600 hover:bg-purple-500 text-white[^"]*rounded-sm/);
  assert.doesNotMatch(cardSrc, /border border-brand\/50 bg-brand\/10 text-brand/);
});

test('AcpAgentAccountSection and AcpAgentModalForm primary action buttons use solid purple without borders', () => {
  const accountSrc = readFileSync(
    new URL('../frontend/features/ai/components/external-agents/AcpAgentAccountSection.tsx', import.meta.url),
    'utf-8'
  );
  const modalSrc = readFileSync(
    new URL('../frontend/features/ai/components/external-agents/AcpAgentModalForm.tsx', import.meta.url),
    'utf-8'
  );

  assert.match(accountSrc, /bg-purple-600 hover:bg-purple-500 text-white/);
  assert.doesNotMatch(accountSrc, /border border-brand\/50 bg-brand\/10/);

  assert.match(modalSrc, /bg-purple-600 hover:bg-purple-500 text-white/);
  assert.doesNotMatch(modalSrc, /border border-brand\/50 bg-brand\/10/);
});
