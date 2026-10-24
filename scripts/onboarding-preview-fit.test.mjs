import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';
import { hookHarness } from './helpers/hookHarness.mjs';

const url = (path) => new URL(`../frontend/features/onboarding/${path}`, import.meta.url);

function fitHarness(t, observed = true) {
  const runner = hookHarness(), listeners = new Map(), observations = [];
  const previousWindow = globalThis.window, previousObserver = globalThis.ResizeObserver;
  let notify, disconnected = false;
  globalThis.window = { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: (name) => listeners.delete(name) };
  globalThis.ResizeObserver = observed ? class {
    constructor(callback) { notify = callback; }
    observe(element) { observations.push(element); }
    disconnect() { disconnected = true; }
  } : undefined;
  const { useOnboardingPreviewFit } = loadWithMocks(url('hooks/useOnboardingPreviewFit.ts'), {
    react: { ...runner.react, useLayoutEffect: runner.react.useEffect },
  });
  const viewport = { clientWidth: 600, clientHeight: 500 };
  const content = { offsetWidth: 600, scrollWidth: 600, offsetHeight: 1000, scrollHeight: 1000,
    getBoundingClientRect: () => assert.fail('Do not measure already-scaled dimensions') };
  const render = () => runner.render(() => {
    const state = useOnboardingPreviewFit();
    state.viewportRef.current = viewport; state.contentRef.current = content;
    return state;
  });
  t.after(() => {
    runner.cleanup();
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousObserver === undefined) delete globalThis.ResizeObserver; else globalThis.ResizeObserver = previousObserver;
  });
  return { render, viewport, content, observations, notify: () => notify(), listeners,
    cleanup: () => runner.cleanup(), disconnected: () => disconnected };
}

test('onboarding preview fits height and width without enlarging or measuring its own transform', (t) => {
  const fit = fitHarness(t); fit.render();
  assert.equal(fit.render().scale, 0.5);
  assert.deepEqual(fit.observations, [fit.viewport, fit.content]);
  fit.viewport.clientHeight = 1200; fit.notify(); assert.equal(fit.render().scale, 1);
  fit.content.scrollWidth = 1200; fit.notify(); assert.equal(fit.render().scale, 0.5);
  fit.content.scrollWidth = 600; fit.content.scrollHeight = 2000;
  fit.notify(); assert.equal(fit.render().scale, 0.6, 'Late font/content changes must re-fit');
  fit.cleanup(); assert.equal(fit.disconnected(), true); assert.equal(fit.listeners.size, 0);
});

test('hidden desktop previews recover on reveal and resize fallback is cleaned up', (t) => {
  const fit = fitHarness(t, false);
  fit.viewport.clientWidth = 0; fit.viewport.clientHeight = 0;
  fit.render(); assert.equal(fit.render().scale, 1, 'Hidden preview must not collapse permanently');
  fit.viewport.clientWidth = 600; fit.viewport.clientHeight = 400;
  fit.listeners.get('resize')(); assert.equal(fit.render().scale, 0.4);
  fit.cleanup(); assert.equal(fit.listeners.size, 0);
});

test('preview has a finite flex viewport and centers the scaled content rather than merely hiding a scrollbar', async (t) => {
  const runner = componentHarness(); t.after(() => runner.cleanup());
  const { OnboardingPreviewFit } = loadWithMocks(url('components/OnboardingPreviewFit.tsx'), {
    react: runner.react,
    '../hooks/useOnboardingPreviewFit': { useOnboardingPreviewFit: () => ({ viewportRef: {}, contentRef: {}, scale: 0.65 }) },
  });
  const nodes = componentNodes(await runner.render(OnboardingPreviewFit, { children: 'All illustration content' }));
  const viewport = nodes.find((node) => Object.hasOwn(node.props, 'data-onboarding-preview-viewport'));
  assert.match(viewport.props.className, /\bmin-h-0\b/); assert.match(viewport.props.className, /\bflex-1\b/);
  const content = nodes.find((node) => Object.hasOwn(node.props, 'data-onboarding-preview-content'));
  assert.equal(content.props.style.transform, 'translate(-50%, -50%) scale(0.65)');
  assert.match(content.props.className, /\babsolute\b/);
});
