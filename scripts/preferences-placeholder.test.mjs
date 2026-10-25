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

  const windowManagerSrc = readFileSync(
    new URL('../backend/src/core/window_manager.rs', import.meta.url),
    'utf-8'
  );
  assert.match(windowManagerSrc, /1120\.0,\s*800\.0/);
  assert.match(windowManagerSrc, /1280\.0,\s*840\.0/, 'ready workspace retains comfortable default dimensions');
  const startupSrc = readFileSync(new URL('../backend/src/core/window_manager/startup_window.rs', import.meta.url), 'utf-8');
  assert.match(startupSrc, /minimum_window_size\(\)/, 'ready main window restores minimum bounds for Preferences');
  assert.match(startupSrc, /set_min_size\(Some\(tauri::LogicalSize::new\(min_width, min_height\)\)\)/);
  assert.equal(mainWindow.width, 600, 'initial window fits the compact splash');
  assert.equal(mainWindow.height, 380);
});
