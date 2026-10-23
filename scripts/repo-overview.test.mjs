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
    new URL('../frontend/core/components/layout/menu-bar/menuIcons.ts', import.meta.url),
    'utf-8'
  );
  assert.match(menuSrc, /import\s*\{[^}]*Info[^}]*\}\s*from/);
  assert.match(menuSrc, /Info/);
  const config = JSON.parse(readFileSync(new URL('../shared/application-menu.json', import.meta.url), 'utf8'));
  assert.equal(config.commands.repo_overview.icon, 'Info');
  assert.equal(config.commands.repo_overview.label, 'Repository Overview...');
  assert.equal(config.commands.repo_overview.shortcut, 'CmdOrCtrl+I');
  assert.ok(config.menus.find((node) => node.id === 'repository_menu').items.some((node) => node.command === 'repo_overview'));
  const actions = readFileSync(new URL('../frontend/core/services/applicationMenuActions.ts', import.meta.url), 'utf8');
  assert.match(actions, /setIsRepoOverviewOpen\(true\)/);
});

test('useWorkspaceShortcuts handles Ctrl+I shortcut for repository overview', () => {
  const shortcutSrc = readFileSync(
    new URL('../frontend/core/services/applicationMenuShortcuts.ts', import.meta.url),
    'utf-8'
  );
  assert.match(shortcutSrc, /menuActionForShortcut/);
  const actions = readFileSync(new URL('../frontend/core/services/applicationMenuActions.ts', import.meta.url), 'utf8');
  assert.match(actions, /repo_overview:\s*\(\) => git.setIsRepoOverviewOpen\(true\)/);
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
    new URL('../frontend/core/components/layout/menu-bar/menuIcons.ts', import.meta.url),
    'utf-8'
  );
  assert.match(submenuSrc, /import\s*\{[^}]*VsCode[^}]*\}\s*from/);
  assert.match(submenuSrc, /VsCode/);
  const config = JSON.parse(readFileSync(new URL('../shared/application-menu.json', import.meta.url), 'utf8'));
  assert.equal(config.commands.open_vscode.icon, 'VsCode');
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


