import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { loadWithMocks } from './helpers/componentHarness.mjs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('shared button surface rule targets opaque fills without touching neutral outlines, inputs or focus', () => {
  const css = read('frontend/core/styles/button-surfaces.css');
  const selectors = css.slice(css.indexOf('button:is('), css.lastIndexOf('{'));
  for (const token of ['btn-solid', 'btn-primary', 'bg-surface0', 'bg-surface1', 'bg-brand', 'bg-red-600']) {
    assert.ok(selectors.includes(`.${token}`), `Missing opaque fill ${token}`);
  }
  assert.ok(selectors.includes('.hover\\:bg-surface0'));
  assert.ok(selectors.includes('.active\\:bg-surface1'));
  assert.match(css, /border-width: 0 !important;/);
  for (const exception of ['bg-transparent', 'bg-white', 'bg-black', 'bg-base', 'bg-mantle', 'bg-crust']) {
    assert.ok(!selectors.includes(`.${exception}`), `${exception} must be allowed to retain borders`);
  }
  assert.doesNotMatch(selectors, /input|select|textarea|focus/);
  assert.ok(read('frontend/core/styles/index.css').includes('@import "./button-surfaces.css";'));
});

test('onboarding wizard uses single-canvas 4-step flow and borderless solid brand buttons', () => {
  const { WELCOME_SLIDES } = loadWithMocks(new URL('../frontend/features/onboarding/constants/welcomeSlides.ts', import.meta.url), {});
  assert.deepEqual(
    WELCOME_SLIDES.map((slide) => slide.id),
    ['hello', 'welcome', 'ai-setup', 'reviewer-setup', 'repository']
  );
  const welcome = read('frontend/features/onboarding/components/FirstLaunchWelcome.tsx');
  assert.ok(welcome.includes('max-w-4xl'));
  assert.ok(welcome.includes('border-0 bg-brand'));
  const aiSetup = read('frontend/features/onboarding/components/WelcomeAiSetup.tsx');
  assert.ok(aiSetup.includes('border-0 bg-brand text-white'));
  assert.doesNotMatch(aiSetup, /Save AI setup/);
});
