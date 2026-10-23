import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('startup.js applies light theme and splash variables when localStorage has light mode', () => {
  const startupCode = fs.readFileSync('public/startup.js', 'utf8');

  const classes = new Set();
  const attributes = {};
  const styles = {};

  const fakeDocument = {
    documentElement: {
      setAttribute(name, value) {
        attributes[name] = value;
      },
      getAttribute(name) {
        return attributes[name];
      },
      classList: {
        add(...args) {
          for (const c of args) classes.add(c);
        },
        remove(...args) {
          for (const c of args) classes.delete(c);
        },
        contains(c) {
          return classes.has(c);
        },
      },
      style: {
        colorScheme: '',
        setProperty(name, value) {
          styles[name] = value;
        },
        getPropertyValue(name) {
          return styles[name];
        },
      },
    },
    addEventListener() {},
    querySelector() {
      return null;
    },
  };

  const fakeLocalStorage = {
    getItem(key) {
      if (key === 'stage0_catppuccin_theme_mode') return 'light';
      return null;
    },
  };

  const fakeWindow = {
    localStorage: fakeLocalStorage,
    matchMedia: () => ({ matches: true }), // OS dark mode, but app prefers light
    addEventListener() {},
    setTimeout() {},
  };

  const context = vm.createContext({
    window: fakeWindow,
    document: fakeDocument,
    console,
  });

  vm.runInContext(startupCode, context);

  assert.equal(attributes['data-theme'], 'mocha-light');
  assert.equal(classes.has('mocha-light'), true);
  assert.equal(classes.has('light'), true);
  assert.equal(classes.has('latte'), true);
  assert.equal(classes.has('mocha'), false);
  assert.equal(classes.has('dark'), false);
  assert.equal(fakeDocument.documentElement.style.colorScheme, 'light');
  assert.equal(styles['--splash-bg'], '#dce0e8');
  assert.equal(styles['--splash-text'], '#3b3e53');
});

test('startup.js applies dark theme and splash variables when localStorage has dark mode', () => {
  const startupCode = fs.readFileSync('public/startup.js', 'utf8');

  const classes = new Set();
  const attributes = {};
  const styles = {};

  const fakeDocument = {
    documentElement: {
      setAttribute(name, value) {
        attributes[name] = value;
      },
      getAttribute(name) {
        return attributes[name];
      },
      classList: {
        add(...args) {
          for (const c of args) classes.add(c);
        },
        remove(...args) {
          for (const c of args) classes.delete(c);
        },
        contains(c) {
          return classes.has(c);
        },
      },
      style: {
        colorScheme: '',
        setProperty(name, value) {
          styles[name] = value;
        },
        getPropertyValue(name) {
          return styles[name];
        },
      },
    },
    addEventListener() {},
    querySelector() {
      return null;
    },
  };

  const fakeLocalStorage = {
    getItem(key) {
      if (key === 'stage0_catppuccin_theme_mode') return 'dark';
      return null;
    },
  };

  const fakeWindow = {
    localStorage: fakeLocalStorage,
    matchMedia: () => ({ matches: false }), // OS light mode, but app prefers dark
    addEventListener() {},
    setTimeout() {},
  };

  const context = vm.createContext({
    window: fakeWindow,
    document: fakeDocument,
    console,
  });

  vm.runInContext(startupCode, context);

  assert.equal(attributes['data-theme'], 'mocha');
  assert.equal(classes.has('mocha'), true);
  assert.equal(classes.has('dark'), true);
  assert.equal(classes.has('mocha-light'), false);
  assert.equal(classes.has('light'), false);
  assert.equal(classes.has('latte'), false);
  assert.equal(fakeDocument.documentElement.style.colorScheme, 'dark');
  assert.equal(styles['--splash-bg'], '#11111b');
  assert.equal(styles['--splash-text'], '#cdd6f4');
});

test('main.tsx preserves stage0_catppuccin_theme_mode from legacy purge and syncs preferences', () => {
  const mainCode = fs.readFileSync('frontend/main.tsx', 'utf8');
  assert.ok(!mainCode.includes("'stage0_catppuccin_theme_mode', 'stage0_catppuccin_theme'"), 'stage0_catppuccin_theme_mode should not be purged in LEGACY_KEYS');
  assert.ok(mainCode.includes("localStorage.setItem('stage0_catppuccin_theme_mode'"), 'main.tsx must sync startup themeMode cache');
});

test('useThemeStore and createPreferencesApplyAction persist theme mode to localStorage', () => {
  const storeCode = fs.readFileSync('frontend/core/store/useThemeStore.ts', 'utf8');
  assert.ok(storeCode.includes('persistThemeMode'), 'useThemeStore must export/use persistThemeMode');
  assert.ok(storeCode.includes("localStorage.setItem(STORAGE_KEY, mode)"), 'useThemeStore must save themeMode to localStorage');

  const applyActionCode = fs.readFileSync('frontend/features/preferences/services/createPreferencesApplyAction.ts', 'utf8');
  assert.ok(applyActionCode.includes('persistThemeMode(draftThemeMode)'), 'createPreferencesApplyAction must persist draft theme mode');
});

