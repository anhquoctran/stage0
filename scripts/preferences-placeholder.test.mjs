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
  // assert.match(containerSrc, /Open General Settings/);
  assert.match(containerSrc, /Cog/);
});

