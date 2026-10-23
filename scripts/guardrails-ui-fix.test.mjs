import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('GuardrailsFilesSection layouts slider and checkboxes cleanly without single-row squishing', () => {
  const filesSectionSrc = readFileSync(
    new URL('../frontend/features/ai/components/guardrails/GuardrailsFilesSection.tsx', import.meta.url),
    'utf-8'
  );

  // Must not cram slider and long checkbox descriptions into a single horizontal row
  assert.doesNotMatch(
    filesSectionSrc,
    /md:flex-row.*justify-between/,
    'Should not use md:flex-row to squish slider and checkbox items together'
  );

  // Slider should have a dedicated container and whitespace-nowrap on label
  assert.match(filesSectionSrc, /max-w-md/);
  assert.match(filesSectionSrc, /whitespace-nowrap/);
  assert.match(filesSectionSrc, /accent-brand/);

  // Checkboxes must remain intact and well-separated
  assert.match(filesSectionSrc, /id="confirm-commands-chk"/);
  assert.match(filesSectionSrc, /id="confirm-writes-chk"/);
});

test('Guardrails tags use solid bold backgrounds, white text, no border, and small rounded corners', () => {
  const cmdSectionSrc = readFileSync(
    new URL('../frontend/features/ai/components/guardrails/GuardrailsCommandSection.tsx', import.meta.url),
    'utf-8'
  );
  const filesSectionSrc = readFileSync(
    new URL('../frontend/features/ai/components/guardrails/GuardrailsFilesSection.tsx', import.meta.url),
    'utf-8'
  );

  // Whitelisted: solid emerald, white text, rounded-sm, no border
  assert.match(cmdSectionSrc, /bg-emerald-600 text-white[^"]*rounded-sm/);
  assert.doesNotMatch(cmdSectionSrc, /border-green\/30/);

  // Blocked destructive: solid red, white text, rounded-sm, no border
  assert.match(cmdSectionSrc, /bg-red-600 text-white[^"]*rounded-sm/);
  assert.doesNotMatch(cmdSectionSrc, /border-red\/30/);

  // Blocked shell patterns: solid amber, white text, rounded-sm, no border
  assert.match(cmdSectionSrc, /bg-amber-600 text-white[^"]*rounded-sm/);
  assert.doesNotMatch(cmdSectionSrc, /border-yellow\/30/);

  // Sensitive files: solid purple, white text, rounded-sm, no border
  assert.match(filesSectionSrc, /bg-purple-600 text-white[^"]*rounded-sm/);
  assert.doesNotMatch(filesSectionSrc, /border-mauve\/30/);
});

test('Simulate Policy Check button uses solid emerald background, white text, and no border', () => {
  const simSectionSrc = readFileSync(
    new URL('../frontend/features/ai/components/guardrails/GuardrailsSimulatorSection.tsx', import.meta.url),
    'utf-8'
  );

  assert.match(simSectionSrc, /bg-emerald-600 hover:bg-emerald-500 text-white/);
  assert.match(simSectionSrc, /Simulate Policy Check/);
  assert.doesNotMatch(simSectionSrc, /bg-green\/15 hover:bg-green\/25 text-green/);
});

test('GuardrailsCommandSection sliders use accent-brand', () => {
  const cmdSectionSrc = readFileSync(
    new URL('../frontend/features/ai/components/guardrails/GuardrailsCommandSection.tsx', import.meta.url),
    'utf-8'
  );

  const rangeCount = (cmdSectionSrc.match(/type="range"/g) || []).length;
  const accentBrandCount = (cmdSectionSrc.match(/accent-brand/g) || []).length;

  assert.equal(rangeCount, 3, 'Should have 3 execution limit sliders');
  assert.equal(accentBrandCount, 3, 'All 3 sliders must use accent-brand');
});

test('index.css enforces brand purple color for range sliders globally', () => {
  const cssSrc = readFileSync(
    new URL('../frontend/core/styles/index.css', import.meta.url),
    'utf-8'
  );

  assert.match(cssSrc, /input\[type="range"\]\s*\{\s*accent-color:\s*var\(--color-brand\)/);
});
