import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('PreferencesModal passes currentTabId directly without falling back to ai-overview', () => {
  const modalSrc = readFileSync(
    new URL('../frontend/features/preferences/components/PreferencesModal.tsx', import.meta.url),
    'utf-8'
  );
  assert.match(modalSrc, /currentTabId=\{currentTabId\}/);
  assert.doesNotMatch(modalSrc, /currentTabId=\{currentTabId\s*\|\|\s*['"]ai-overview['"]\}/);
});

test('PreferencesNavTree does not bold or activate any group when currentTabId is null', () => {
  const navSrc = readFileSync(
    new URL('../frontend/features/preferences/components/PreferencesNavTree.tsx', import.meta.url),
    'utf-8'
  );
  assert.match(navSrc, /currentTabId:\s*PreferenceTab\s*\|\s*null/);
  assert.match(navSrc, /Boolean\(currentTabId\s*&&\s*group\.children\.some/);
});

test('PreferencesTabContainer renders placeholder screen when no tab is selected', () => {
  const containerSrc = readFileSync(
    new URL('../frontend/features/preferences/components/PreferencesTabContainer.tsx', import.meta.url),
    'utf-8'
  );
  assert.match(containerSrc, /!isKnownTab/);
  assert.match(containerSrc, /No preference selected/);
  assert.match(containerSrc, /Cog/);
});

test('PreferencesModal and window configuration accommodate the full dialog dimensions', () => {
  const modalSrc = readFileSync(
    new URL('../frontend/features/preferences/components/PreferencesModal.tsx', import.meta.url),
    'utf-8'
  );
  assert.match(modalSrc, /max-w-5xl/);
  assert.match(modalSrc, /h-\[760px\]/);
  assert.match(modalSrc, /max-h-\[calc\(100vh-2rem\)\]/);

  const tauriConf = JSON.parse(
    readFileSync(new URL('../backend/tauri.conf.json', import.meta.url), 'utf-8')
  );
  const mainWindow = tauriConf.app.windows.find((w) => w.label === 'main');
  assert.ok(mainWindow, 'main window must be configured');
  assert.ok(mainWindow.minWidth >= 1100, `minWidth (${mainWindow.minWidth}) must accommodate max-w-5xl dialog`);
  assert.ok(mainWindow.minHeight >= 780, `minHeight (${mainWindow.minHeight}) must accommodate h-[760px] dialog`);
  assert.ok(mainWindow.width >= 1280, 'default width must provide comfortable workspace');
  assert.ok(mainWindow.height >= 820, 'default height must provide comfortable workspace');

  const windowManagerSrc = readFileSync(
    new URL('../backend/src/core/window_manager.rs', import.meta.url),
    'utf-8'
  );
  assert.match(windowManagerSrc, /1120\.0,\s*800\.0/);
});
