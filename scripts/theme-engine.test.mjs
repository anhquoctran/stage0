import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { loadWithMocks } from './helpers/componentHarness.mjs';

const themePackage = (file) => ({ default: JSON.parse(fs.readFileSync(file, 'utf8')) });
const themeDependencies = {
  '../../../themes/color-tokens.json': themePackage('themes/color-tokens.json'),
  '../../../themes/dark/catppuccin-mocha/theme.json': themePackage('themes/dark/catppuccin-mocha/theme.json'),
  '../../../themes/light/catppuccin-latte/theme.json': themePackage('themes/light/catppuccin-latte/theme.json'),
};
const { validateTheme, parseThemePackage } = loadWithMocks(new URL('../frontend/core/themes/validateTheme.ts', import.meta.url), themeDependencies);
const { ThemeRegistry } = loadWithMocks(new URL('../frontend/core/themes/ThemeRegistry.ts', import.meta.url), themeDependencies);
const definition = (patch = {}) => ({ schemaVersion: 1, id: 'ocean-night', name: 'Ocean Night', kind: 'dark', version: '1.0.0', colors: { base: '#112233', text: '#eee', brand: 'rgba(10, 20, 30, 0.8)' }, ...patch });

function readStylesheet(file, visited = new Set()) {
  const url = file instanceof URL ? file : new URL(file, new URL('../', import.meta.url));
  if (visited.has(url.href)) return '';
  visited.add(url.href);
  const source = fs.readFileSync(url, 'utf8');
  return source.replace(/@import\s+["']([^"']+)["'];/g, (statement, imported) =>
    imported.startsWith('.') ? readStylesheet(new URL(imported, url), visited) : statement);
}

test('theme packages validate and freeze data without retaining caller-owned mutable records', () => {
  const input = definition(), result = parseThemePackage(JSON.stringify(input));
  input.colors.base = '#ffffff';
  assert.equal(result.colors.base, '#112233');
  assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.colors));
  assert.deepEqual(validateTheme(definition({ kind: 'light', id: 'ocean-day' })).kind, 'light');
});

test('invalid theme packages cannot introduce code, CSS selectors, remote assets or prototype keys', () => {
  for (const color of ['url(https://bad.example/image)', 'red;display:none', 'var(--unknown)', 'expression(alert(1))', '#fff}', 'rgba(256,0,0,1)', 'rgba(0,0,0,2)', 'rgb(0,0,0,1)', 'rgba(0,0,0)', 'calc(1px)'])
    assert.throws(() => validateTheme(definition({ colors: { base: color } })), /color token/);
  for (const patch of [{ schemaVersion: 2 }, { kind: 'auto' }, { id: '../other' }, { id: 'mocha' }, { name: '<script>' }, { version: 'latest' }, { css: 'body {display:none}' }, { script: 'alert(1)' }, { colors: { '--density-control-height': '#fff' } }])
    assert.throws(() => validateTheme(definition(patch)));
  assert.throws(() => parseThemePackage('{"__proto__":{},"schemaVersion":1}'));
  assert.throws(() => parseThemePackage(' '.repeat(32769)), /32 KiB/);
  assert.throws(() => parseThemePackage('{not json}'));
  assert.throws(() => validateTheme(Object.assign(Object.create({ hidden: 1 }), definition())));
});

test('registry groups themes, rejects duplicates atomically and publishes stable immutable snapshots', () => {
  const registry = new ThemeRegistry(); let publications = 0;
  const stop = registry.subscribe(() => publications++);
  registry.register(definition());
  registry.register(definition({ id: 'ocean-day', kind: 'light' }));
  const snapshot = registry.getSnapshot();
  assert.deepEqual(registry.list('dark').map(item => item.id), ['ocean-night']);
  assert.deepEqual(registry.list('light').map(item => item.id), ['ocean-day']);
  assert.ok(Object.isFrozen(snapshot)); assert.strictEqual(registry.getSnapshot(), snapshot);
  assert.throws(() => registry.register(definition()), /already registered/);
  assert.throws(() => registry.register(definition({ id: 'unsafe', colors: { base: 'url(x)' } })));
  assert.strictEqual(registry.getSnapshot(), snapshot); assert.equal(publications, 2);
  stop(); registry.register(definition({ id: 'third' })); assert.equal(publications, 2);
});

test('built-in packages declare Dark/Light groups and keep all legacy palette and splash colors', () => {
  const expected = {
    "dark": {
      "--brand": "#9333ea",
      "--ctp-brand": "#9333ea",
      "--ctp-on-accent": "#ffffff",
      "--ctp-rosewater": "#f5e0dc",
      "--ctp-flamingo": "#f2cdcd",
      "--ctp-pink": "#f5c2e7",
      "--ctp-mauve": "#cba6f7",
      "--ctp-red": "#ff4455",
      "--ctp-maroon": "#ff6b81",
      "--ctp-peach": "#fab387",
      "--ctp-yellow": "#f9e2af",
      "--ctp-green": "#a6e3a1",
      "--ctp-teal": "#94e2d5",
      "--ctp-sky": "#89dceb",
      "--ctp-sapphire": "#74c7ec",
      "--ctp-blue": "#89b4fa",
      "--ctp-lavender": "#b4befe",
      "--ctp-text": "#cdd6f4",
      "--ctp-subtext1": "#bac2de",
      "--ctp-subtext0": "#a6adc8",
      "--ctp-overlay2": "#9399b2",
      "--ctp-overlay1": "#7f849c",
      "--ctp-overlay0": "#6c7086",
      "--ctp-surface2": "#585b70",
      "--ctp-surface1": "#45475a",
      "--ctp-surface0": "#313244",
      "--ctp-base": "#1e1e2e",
      "--ctp-mantle": "#181825",
      "--ctp-crust": "#11111b",
      "--diff-added-background": "#18271f",
      "--diff-deleted-background": "#23191c",
      "--bg-canvas": "var(--ctp-crust)",
      "--bg-subtle": "var(--ctp-mantle)",
      "--bg-surface": "var(--ctp-base)",
      "--bg-overlay": "var(--ctp-surface0)",
      "--interactive-input-bg": "var(--ctp-base)",
      "--border-default": "var(--ctp-surface0)",
      "--border-muted": "var(--ctp-surface1)",
      "--text-primary": "var(--ctp-text)",
      "--text-secondary": "var(--ctp-subtext1)",
      "--text-muted": "var(--ctp-subtext0)",
      "--backdrop-modal": "rgba(0, 0, 0, 0.6)",
      "--preferences-card-bg": "#11111b",
      "--preferences-card-border": "#313244",
      "--preferences-choice-selected-bg": "rgba(147, 51, 234, 0.1)",
      "--preferences-choice-selected-border": "rgba(147, 51, 234, 0.5)",
      "--preferences-danger-bg": "#b4233c",
      "--preferences-danger-border": "#e85d75",
      "--preferences-danger-text": "#ffffff",
      "--preferences-danger-icon-bg": "rgba(255, 255, 255, 0.14)",
      "--splash-bg": "#11111b",
      "--splash-text": "#cdd6f4",
      "--splash-subtext": "#bac2de",
      "--splash-status": "#a6adc8",
      "--splash-muted": "#7f849c",
      "--splash-brand": "#9333ea",
      "--splash-title-accent": "#89b4fa",
      "--splash-logo-border": "rgba(147, 51, 234, 0.4)",
      "--splash-logo-bg": "linear-gradient(135deg, rgba(147, 51, 234, 0.2), rgba(147, 51, 234, 0.1) 55%, #313244)",
      "--splash-logo-shadow": "0 12px 30px rgba(147, 51, 234, 0.12)",
      "--splash-track-border": "rgba(49, 50, 68, 0.4)",
      "--splash-track-bg": "rgba(49, 50, 68, 0.6)",
      "--splash-frame-border": "#313244",
      "--splash-glow-blue": "rgba(137, 180, 250, 0.1)",
      "--splash-glow-purple": "rgba(147, 51, 234, 0.1)",
      "--splash-peach": "#fab387",
      "--splash-teal": "#94e2d5",
      "--splash-green": "#a6e3a1",
      "--splash-error": "#f38ba8",
      "--splash-warning": "#fab387"
    },
    "light": {
      "--brand": "#9333ea",
      "--ctp-brand": "#9333ea",
      "--ctp-on-accent": "#ffffff",
      "--ctp-rosewater": "#dc8a78",
      "--ctp-flamingo": "#dd7878",
      "--ctp-pink": "#ea76cb",
      "--ctp-mauve": "#8839ef",
      "--ctp-red": "#e11d48",
      "--ctp-maroon": "#f43f5e",
      "--ctp-peach": "#fe640b",
      "--ctp-yellow": "#df8e1d",
      "--ctp-green": "#40a02b",
      "--ctp-teal": "#179299",
      "--ctp-sky": "#04a5e5",
      "--ctp-sapphire": "#209fb5",
      "--ctp-blue": "#1e66f5",
      "--ctp-lavender": "#7287fd",
      "--ctp-text": "#3b3e53",
      "--ctp-subtext1": "#4b5066",
      "--ctp-subtext0": "#5b6075",
      "--ctp-overlay2": "#666c80",
      "--ctp-overlay1": "#7a8093",
      "--ctp-overlay0": "#8d92a3",
      "--ctp-surface2": "#969eae",
      "--ctp-surface1": "#aab1c0",
      "--ctp-surface0": "#bec4d0",
      "--ctp-base": "#eff1f5",
      "--ctp-mantle": "#e6e9ef",
      "--ctp-crust": "#dce0e8",
      "--diff-added-background": "#dafbe1",
      "--diff-deleted-background": "#ffebe9",
      "--bg-canvas": "var(--ctp-crust)",
      "--bg-subtle": "var(--ctp-mantle)",
      "--bg-surface": "var(--ctp-base)",
      "--bg-overlay": "var(--ctp-surface0)",
      "--interactive-input-bg": "#ffffff",
      "--border-default": "var(--ctp-surface0)",
      "--border-muted": "var(--ctp-surface1)",
      "--text-primary": "var(--ctp-text)",
      "--text-secondary": "var(--ctp-subtext1)",
      "--text-muted": "var(--ctp-subtext0)",
      "--backdrop-modal": "rgba(59, 62, 83, 0.28)",
      "--preferences-card-bg": "#f7f8fb",
      "--preferences-card-border": "#c7ccd8",
      "--preferences-choice-selected-bg": "rgba(147, 51, 234, 0.07)",
      "--preferences-choice-selected-border": "rgba(147, 51, 234, 0.42)",
      "--preferences-danger-bg": "#c62845",
      "--preferences-danger-border": "#a91f38",
      "--preferences-danger-text": "#ffffff",
      "--preferences-danger-icon-bg": "rgba(255, 255, 255, 0.16)",
      "--splash-bg": "#dce0e8",
      "--splash-text": "#3b3e53",
      "--splash-subtext": "#4b5066",
      "--splash-status": "#5b6075",
      "--splash-muted": "#666c80",
      "--splash-brand": "#9333ea",
      "--splash-title-accent": "#1e66f5",
      "--splash-logo-border": "rgba(147, 51, 234, 0.38)",
      "--splash-logo-bg": "linear-gradient(135deg, rgba(147, 51, 234, 0.16), rgba(147, 51, 234, 0.07) 55%, #bec4d0)",
      "--splash-logo-shadow": "0 12px 30px rgba(76, 79, 105, 0.16)",
      "--splash-track-border": "rgba(150, 158, 174, 0.72)",
      "--splash-track-bg": "rgba(190, 196, 208, 0.72)",
      "--splash-frame-border": "#bec4d0",
      "--splash-glow-blue": "rgba(30, 102, 245, 0.12)",
      "--splash-glow-purple": "rgba(147, 51, 234, 0.1)",
      "--splash-peach": "#fe640b",
      "--splash-teal": "#179299",
      "--splash-green": "#40a02b",
      "--splash-error": "#c62845",
      "--splash-warning": "#9a5b00"
    }
  };
  for (const [kind, id] of [['dark', 'catppuccin-mocha'], ['light', 'catppuccin-latte']]) {
    const path = `themes/${kind}/${id}/theme`;
    assert.equal(validateTheme(JSON.parse(fs.readFileSync(`${path}.json`, 'utf8'))).kind, kind);
    const css = readStylesheet(`${path}.css`);
    const actual = Object.fromEntries([...css.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, key, value]) => [key.replace('--theme-', '--ctp-'), value.replaceAll('--theme-', '--ctp-')]));
    for (const [key, value] of Object.entries(expected[kind])) {
      if (key === '--brand') continue; // Now aliases the same brand token in compatibility.css.
      assert.equal(actual[key], value, `${kind}: ${key}`);
    }
  }
  const global = fs.readFileSync('frontend/core/styles/index.css', 'utf8');
  assert.doesNotMatch(global, /--ctp-|mocha|latte/);
  assert.ok(fs.readFileSync('index.html', 'utf8').includes('href="/themes/index.css"'));
});

test('public registry accepts a new theme without editing component CSS or granting runtime capabilities', () => {
  const engine = loadWithMocks(new URL('../frontend/core/themes/index.ts', import.meta.url), themeDependencies);
  const theme = engine.themeRegistry.register(definition());
  assert.equal(engine.getTheme(theme.id).name, 'Ocean Night');
  assert.equal(engine.themeColorScheme(theme.id), 'dark');
  assert.equal(engine.themeColorScheme('mocha-light'), 'light');
  assert.equal(engine.getTheme('unknown').id, engine.DEFAULT_THEMES.dark);
});

function runtime(t, { saved = {}, media = true, blocked = false } = {}) {
  const savedGlobals = new Map(['window', 'document', 'localStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const properties = new Map(), attributes = new Map(), classes = new Set();
  const events = new Map(); let osChange;
  const query = { matches: true, addEventListener: (_, callback) => { osChange = callback; }, addListener: callback => { osChange = callback; } };
  globalThis.document = { body: { style: {} }, documentElement: {
    setAttribute: (key, value) => attributes.set(key, value),
    classList: { add: (...items) => items.forEach(item => classes.add(item)), remove: (...items) => items.forEach(item => classes.delete(item)) },
    style: { setProperty: (key, value) => properties.set(key, value), removeProperty: key => properties.delete(key) },
  } };
  globalThis.window = { __STAGE0_PREFERENCES__: {}, ...(media ? { matchMedia: () => query } : {}), addEventListener: (name, callback) => events.set(name, callback) };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => { if (blocked) throw Error('Storage blocked'); return saved[key] ?? null; },
    setItem: (key, value) => { if (blocked) throw Error('Storage blocked'); saved[key] = value; },
  } });
  const store = loadWithMocks(new URL('../frontend/core/store/useThemeStore.ts', import.meta.url), {
    '../../features/preferences/services/preferencesJsonService': { preferencesJsonService: { patch: async () => {} } },
  });
  t.after(() => { for (const [key, descriptor] of savedGlobals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  } });
  return { ...store, attributes, properties, classes, events, changeOs(dark) { query.matches = dark; osChange(); } };
}

test('blocked storage and unavailable media queries do not prevent startup and keep the dark fallback', t => {
  const f = runtime(t, { blocked: true, media: false });
  assert.equal(f.useThemeStore.getState().themeMode, 'system');
  assert.equal(f.useThemeStore.getState().theme, 'mocha');
  assert.equal(f.attributes.get('data-color-scheme'), 'dark');
});

test('legacy storage, System mode and cross-window publications retain their compatibility contracts', t => {
  const f = runtime(t, { saved: { stage0_catppuccin_theme: 'mocha-light' } });
  assert.equal(f.useThemeStore.getState().themeMode, 'light');
  assert.ok(f.classes.has('latte'));
  f.useThemeStore.getState().setThemeMode('system');
  f.changeOs(false); assert.equal(f.useThemeStore.getState().theme, 'mocha-light');
  f.changeOs(true); assert.equal(f.useThemeStore.getState().theme, 'mocha');
  f.events.get('stage0-preferences-updated')({ detail: { appearance: { themeMode: 'light' } } });
  assert.equal(f.useThemeStore.getState().themeMode, 'light');
  assert.equal(f.attributes.get('data-theme-id'), 'catppuccin-latte');
});
