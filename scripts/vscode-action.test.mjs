import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as tauriCore from '@tauri-apps/api/core';
import { loadWithMocks } from './helpers/componentHarness.mjs';

// Resolve extensionless frontend imports through the same loader as other fixtures.
const { formatFriendlyVsCodeError } = loadWithMocks(
  new URL('../frontend/features/git/utils/fileActions.ts', import.meta.url),
  { '@tauri-apps/api/core': tauriCore },
);

test('formatFriendlyVsCodeError provides friendly actionable guidance for missing/misconfigured VS Code across platforms', () => {
  const err1 = new Error('Failed to launch Visual Studio Code. Please ensure Code.exe is in your PATH.');
  const msg1 = formatFriendlyVsCodeError(err1);
  assert.match(msg1, /Visual Studio Code is not installed or not configured in system PATH/);

  const errMac = new Error('Visual Studio Code is not installed or not found in /Applications. Please install VS Code or run \'Shell Command: Install code command in PATH\' from VS Code Command Palette.');
  const msgMac = formatFriendlyVsCodeError(errMac);
  assert.match(msgMac, /not found in \/Applications/);
  assert.match(msgMac, /Install code command in PATH/);

  const errLinux = new Error('Visual Studio Code is not installed or not found in PATH, Snap, or Flatpak. Please ensure VS Code is installed and available.');
  const msgLinux = formatFriendlyVsCodeError(errLinux);
  assert.match(msgLinux, /Snap, or Flatpak/);

  const errENOENT = 'spawn code ENOENT: not found';
  const msgENOENT = formatFriendlyVsCodeError(errENOENT);
  assert.match(msgENOENT, /Visual Studio Code is not installed or not configured in system PATH/);

  const errGeneric = new Error('Permission denied');
  const msgGeneric = formatFriendlyVsCodeError(errGeneric);
  assert.equal(msgGeneric, 'Failed to open Visual Studio Code: Permission denied');
});

test('vscode_launcher.rs implements platform-specific launching for Windows, macOS and Linux', () => {
  const launcherSrc = readFileSync(
    new URL('../backend/src/features/git/commands/vscode_launcher.rs', import.meta.url),
    'utf-8'
  );

  // Windows checks
  assert.match(launcherSrc, /cfg\(target_os = "windows"\)/);
  assert.match(launcherSrc, /Microsoft VS Code/);
  assert.match(launcherSrc, /LOCALAPPDATA/);
  assert.match(launcherSrc, /code\.cmd/);

  // macOS checks
  assert.match(launcherSrc, /cfg\(target_os = "macos"\)/);
  assert.match(launcherSrc, /\/Applications\/Visual Studio Code\.app\/Contents\/Resources\/app\/bin\/code/);
  assert.match(launcherSrc, /\/opt\/homebrew\/bin\/code/);
  assert.match(launcherSrc, /com\.microsoft\.VSCode/);
  assert.match(launcherSrc, /open/);

  // Linux checks
  assert.match(launcherSrc, /cfg\(not\(any\(target_os = "windows", target_os = "macos"\)\)\)/);
  assert.match(launcherSrc, /\/snap\/bin\/code/);
  assert.match(launcherSrc, /com\.visualstudio\.code/);
  assert.match(launcherSrc, /flatpak/);
  assert.match(launcherSrc, /\/usr\/bin\/code/);
});

test('RepositoryOverviewModal handles VS Code click with try/catch and error toast', () => {
  const modalSrc = readFileSync(
    new URL('../frontend/features/git/components/RepositoryOverviewModal.tsx', import.meta.url),
    'utf-8'
  );
  assert.match(modalSrc, /handleOpenInVsCode/);
  assert.match(modalSrc, /showToast\(msg,\s*['"]error['"]\)/);
  assert.match(modalSrc, /showToast\(['"]Opened repository in VS Code['"],\s*['"]success['"]\)/);
});

test('RepositoryOpenSubmenu handles VS Code click with error toast level', () => {
  const submenuSrc = readFileSync(
    new URL('../frontend/core/services/applicationMenuFileActions.ts', import.meta.url),
    'utf-8'
  );
  assert.match(submenuSrc, /showToast\(msg,\s*['"]error['"]\)/);
  assert.match(submenuSrc, /showToast\(['"]Opened repository in VS Code['"],\s*['"]success['"]\)/);
});

test('ConflictBanner uses official VsCode icon and displays error toast on launch failure', () => {
  const bannerSrc = readFileSync(
    new URL('../frontend/features/git/components/ConflictBanner.tsx', import.meta.url),
    'utf-8'
  );
  assert.match(bannerSrc, /import\s*\{[^}]*VsCode[^}]*\}\s*from/);
  assert.match(bannerSrc, /<VsCode/);
  assert.match(bannerSrc, /showToast\(msg,\s*['"]error['"]\)/);
});
