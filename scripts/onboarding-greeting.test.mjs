import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';

const url = path => new URL(`../frontend/features/onboarding/${path}`, import.meta.url);
const { SUPPORTED_LANGUAGES } = loadWithMocks(new URL('../frontend/features/i18n/constants/supportedLanguages.ts', import.meta.url), {});
const { GREETING_ARTWORK } = loadWithMocks(url('constants/greetingArtwork.ts'), {});
const translation = code => JSON.parse(readFileSync(new URL(`../frontend/features/i18n/locales/${code}.json`, import.meta.url)));

test('the welcome greeting follows all 14 languages using pen strokes and restores the original English drawing', async t => {
  const runner = componentHarness(); t.after(runner.cleanup);
  let language = 'en';
  const { OnboardingHello } = loadWithMocks(url('components/OnboardingHello.tsx'), {
    react: runner.react,
    'react-i18next': { useTranslation: () => ({ t: key => key.split('.').reduce((v, k) => v?.[k], translation(language)) ?? key }) },
    '@/common/components/icons/ArrowRight': { ArrowRight: () => null },
    '@/features/i18n/hooks/useAppLanguagePreference': { useAppLanguagePreference: () => ({ language, saving: false, error: null, changeLanguage() {} }) },
    './OnboardingLanguagePicker': { OnboardingLanguagePicker: () => null },
    '../hooks/useGreetingHandwriting': { useGreetingHandwriting() {} },
    '../styles/onboarding-hello.css': {},
  });
  const render = async () => componentNodes(await runner.render(OnboardingHello, { onContinue() {} }));
  for (const { code } of SUPPORTED_LANGUAGES) {
    language = code;
    const nodes = await render();
    const svg = nodes.find(node => node.type === 'svg' && node.props['data-greeting-language'] === code);
    assert.ok(svg, `${code} must have its own pen artwork, not a font/wipe fallback`);
    assert.equal(svg.props.lang, code);
    assert.equal(nodes.find(node => node.props.id === 'first-launch-title').props.children.join(''), translation(code).onboarding.hello.title);
    assert.equal(nodes.find(node => node.type === 'title').props.children.join(''), translation(code).onboarding.hello.title);
    assert.equal(svg.props['aria-hidden'], 'true', 'The visible artwork must not duplicate the localized accessible heading');
    const strokes = nodes.filter(node => Object.hasOwn(node.props, 'data-handwriting-stroke'));
    assert.deepEqual(strokes.map(node => node.props.d), GREETING_ARTWORK[code].strokes.map(stroke => stroke.d));
    assert.ok(strokes.every(node => node.props.pathLength === '1'));
    assert.ok(nodes.some(node => node.type === 'mask'), 'Only the pen centerlines mask the gradient');
    if (code !== 'en') assert.notDeepEqual(strokes.map(node => node.props.d), GREETING_ARTWORK.en.strokes.map(stroke => stroke.d));
  }
  language = 'en';
  const nodes = await render();
  assert.equal(nodes.filter(node => Object.hasOwn(node.props, 'data-handwriting-stroke')).length, 1);
  assert.ok(GREETING_ARTWORK.en.strokes[0].d.startsWith('M44 170 C70 145'));
});

test('handwritten artwork covers the canonical locales, preserves accents and credits borrowed CJK strokes', () => {
  assert.deepEqual(Object.keys(GREETING_ARTWORK).sort(), SUPPORTED_LANGUAGES.map(({ code }) => code).sort());
  assert.ok(GREETING_ARTWORK.vi.strokes.some(({ d }) => d === 'M25 34 L35 44'), 'Vietnamese grave accent is a real pen stroke');
  assert.ok(GREETING_ARTWORK['pt-BR'].strokes.some(({ d }) => d === 'M26 43 L40 28'), 'Portuguese acute accent is a real pen stroke');
  for (const code of ['ja', 'zh-Hans', 'zh-Hant']) assert.match(GREETING_ARTWORK[code].attribution, /KanjiVG.*CC BY-SA 3\.0/);
  assert.deepEqual(GREETING_ARTWORK['zh-Hans'], GREETING_ARTWORK['zh-Hant']);
  assert.deepEqual(GREETING_ARTWORK['pt-BR'], GREETING_ARTWORK['pt-PT']);
  assert.ok(GREETING_ARTWORK.ar.strokes[0].d.startsWith('M354'), 'Arabic starts on the physical right');
});
