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

test('onboarding artwork fills its preview and comparison demonstrates an actual readable diff', () => {
  for (const artwork of ['Branch', 'Compare', 'Review']) {
    const source = read(`frontend/features/onboarding/components/${artwork}Artwork.tsx`);
    assert.doesNotMatch(source, /max-w-100/);
  }
  const comparison = read('frontend/features/onboarding/components/CompareArtwork.tsx');
  assert.ok(comparison.includes('bg-red-600'));
  assert.ok(comparison.includes('bg-emerald-600'));
  assert.ok(comparison.includes('expiresAt'));
  assert.doesNotMatch(comparison, /Sparkles/);
});

test('onboarding adds explanatory copy and illustrative scenes without claiming live activity', () => {
  const { WELCOME_SLIDES } = loadWithMocks(new URL('../frontend/features/onboarding/constants/welcomeSlides.ts', import.meta.url), {});
  assert.deepEqual(WELCOME_SLIDES.filter((slide) => slide.highlights).map((slide) => slide.id),
    ['welcome', 'compare', 'review', 'repository']);
  assert.ok(WELCOME_SLIDES.filter((slide) => slide.highlights).every((slide) =>
    slide.highlights.length === 2 && slide.highlights.every((item) => item.title && item.description)));
  const scene = read('frontend/features/onboarding/components/WelcomeArtworkScene.tsx');
  assert.ok(scene.includes('Sample workspace'));
  assert.ok(scene.includes('scene.metrics.map'));
  assert.ok(scene.includes('scene.steps.map'));
  assert.ok(!scene.includes('{index + 1}'), 'Illustrated workflow uses dots, not visible step numbers');
  assert.doesNotMatch(scene, /setInterval|setTimeout|fetch\(|invoke\(/);
  const motion = read('frontend/core/styles/onboarding-artwork.css');
  assert.ok(motion.includes('prefers-reduced-motion: reduce'));
  for (const name of ['flow', 'pulse', 'connector']) {
    assert.ok(motion.includes(`.stage0-welcome-${name}`));
    assert.ok(motion.slice(motion.indexOf('@media')).includes(`.stage0-welcome-${name}`));
  }
  assert.match(motion, /@media[^]*animation: none;/);
});
