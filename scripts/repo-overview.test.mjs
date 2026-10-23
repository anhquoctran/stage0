import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('TopBar renders TopBarRepoOverviewButton right-aligned', () => {
  const topBarSrc = readFileSync(
    new URL('../frontend/core/components/layout/TopBar.tsx', import.meta.url),
    'utf-8'
  );
  assert.match(topBarSrc, /TopBarRepoOverviewButton/);
  // Must be in the right section (justify-between right container)
  assert.match(topBarSrc, /Right Section[\s\S]*TopBarRepoOverviewButton/);
});

test('TopBarRepoOverviewButton uses circle Info icon and triggers modal', () => {
  const buttonSrc = readFileSync(
    new URL('../frontend/core/components/layout/top-bar/TopBarRepoOverviewButton.tsx', import.meta.url),
    'utf-8'
  );
  assert.match(buttonSrc, /import\s*\{\s*Info\s*\}\s*from/);
  assert.match(buttonSrc, /<Info\s+className=/);
  assert.match(buttonSrc, /setIsRepoOverviewOpen\(true\)/);
  assert.match(buttonSrc, /Overview/);
});

test('MenuBarRepositoryMenu contains Repository Overview action with circle Info icon', () => {
  const menuSrc = readFileSync(
    new URL('../frontend/core/components/layout/menu-bar/MenuBarRepositoryMenu.tsx', import.meta.url),
    'utf-8'
  );
  assert.match(menuSrc, /import\s*\{[^}]*Info[^}]*\}\s*from/);
  assert.match(menuSrc, /<Info\s+className=/);
  assert.match(menuSrc, /Repository Overview\.\.\./);
  assert.match(menuSrc, /setIsRepoOverviewOpen\(true\)/);
  assert.match(menuSrc, /Ctrl\+I/);
});

test('useWorkspaceShortcuts handles Ctrl+I shortcut for repository overview', () => {
  const shortcutSrc = readFileSync(
    new URL('../frontend/core/components/hooks/useWorkspaceShortcuts.ts', import.meta.url),
    'utf-8'
  );
  assert.match(shortcutSrc, /isOverviewShortcut/);
  assert.match(shortcutSrc, /setIsRepoOverviewOpen\(true\)/);
});

test('MainLayoutModals includes RepositoryOverviewModal', () => {
  const modalsSrc = readFileSync(
    new URL('../frontend/core/components/layout/MainLayoutModals.tsx', import.meta.url),
    'utf-8'
  );
  assert.match(modalsSrc, /RepositoryOverviewModal/);
  assert.match(modalsSrc, /<RepositoryOverviewModal\s*\/>/);
});

test('createGitUiModalsSlice manages isRepoOverviewOpen state and setter', () => {
  const sliceSrc = readFileSync(
    new URL('../frontend/features/git/store/slices/createGitUiModalsSlice.ts', import.meta.url),
    'utf-8'
  );
  assert.match(sliceSrc, /isRepoOverviewOpen:\s*false/);
  assert.match(sliceSrc, /setIsRepoOverviewOpen:\s*\(open\)\s*=>/);
});

test('RepositoryOverviewModal uses standard green/blue badges and official VsCode icon', () => {
  const modalSrc = readFileSync(
    new URL('../frontend/features/git/components/RepositoryOverviewModal.tsx', import.meta.url),
    'utf-8'
  );
  assert.match(modalSrc, /VsCode/);
  assert.match(modalSrc, /<VsCode\s+className=/);
  // Solid green background with white text for open MRs
  assert.match(modalSrc, /bg-green-600 text-white/);
  // Solid blue background with white text for resolved MRs
  assert.match(modalSrc, /bg-blue-600 text-white/);
  // Solid gray background with white text for closed MRs
  assert.match(modalSrc, /bg-gray-600 text-white/);
});

test('RepositoryOpenSubmenu uses official VsCode icon', () => {
  const submenuSrc = readFileSync(
    new URL('../frontend/core/components/layout/menu-bar/RepositoryOpenSubmenu.tsx', import.meta.url),
    'utf-8'
  );
  assert.match(submenuSrc, /import\s*\{[^}]*VsCode[^}]*\}\s*from/);
  assert.match(submenuSrc, /<VsCode\s+className=/);
});

test('RepositoryOverviewModal leaves TopBar window controls and title row accessible', () => {
  const modalSrc = readFileSync(
    new URL('../frontend/features/git/components/RepositoryOverviewModal.tsx', import.meta.url),
    'utf-8'
  );
  // Must start below the titlebar (top-8.5) and have z-index below TopBarTitleRow (z-[100])
  assert.match(modalSrc, /top-8\.5/);
  assert.match(modalSrc, /z-50/);
  assert.doesNotMatch(modalSrc, /fixed inset-0/);
});



