import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

test('MenuBarHelpMenu renders View release notes menu item above About Stage0', () => {
  const menuSrc = readFileSync(
    new URL('../frontend/core/components/layout/menu-bar/MenuBarHelpMenu.tsx', import.meta.url),
    'utf-8'
  );

  const releaseNotesIndex = menuSrc.indexOf('View release notes');
  const aboutIndex = menuSrc.indexOf('About Stage0');

  assert.ok(releaseNotesIndex !== -1, 'View release notes menu item must exist');
  assert.ok(aboutIndex !== -1, 'About Stage0 menu item must exist');
  assert.ok(
    releaseNotesIndex < aboutIndex,
    'View release notes must be positioned above About Stage0'
  );
  assert.match(menuSrc, /onOpenReleaseNotes\(\)/);
});

test('MenuBar wires showReleaseNotesModal state and mounts ReleaseNotesModal', () => {
  const menuBarSrc = readFileSync(
    new URL('../frontend/core/components/layout/MenuBar.tsx', import.meta.url),
    'utf-8'
  );

  assert.match(menuBarSrc, /showReleaseNotesModal/);
  assert.match(menuBarSrc, /onOpenReleaseNotes=\{[^}]*setShowReleaseNotesModal\(true\)\}/);
  assert.match(menuBarSrc, /<ReleaseNotesModal/);
});

test('ReleaseNotesModal uses enlarged dimensions and MarkdownPreview for rich media', () => {
  const modalSrc = readFileSync(
    new URL('../frontend/features/about/components/ReleaseNotesModal.tsx', import.meta.url),
    'utf-8'
  );

  assert.match(modalSrc, /max-w-4xl/);
  assert.match(modalSrc, /MarkdownPreview/);
  assert.match(modalSrc, /Release Notes/);
  assert.match(modalSrc, /useReleaseNotes/);
});

test('CSS provides rich markdown styling for images and tables', () => {
  const cssSrc = readFileSync(
    new URL('../frontend/core/styles/index.css', import.meta.url),
    'utf-8'
  );

  assert.match(cssSrc, /\.markdown-preview img/);
  assert.match(cssSrc, /\.markdown-preview table/);
});

test('RELEASE_NOTES.md exists and is scoped to the current version v0.1.11', () => {
  const filePath = new URL('../RELEASE_NOTES.md', import.meta.url);
  assert.ok(existsSync(filePath), 'RELEASE_NOTES.md must exist in root');

  const notesSrc = readFileSync(filePath, 'utf-8');
  assert.match(notesSrc, /Stage0 v0\.1\.11 Release Notes/);
  assert.match(notesSrc, /Current Version Release Notes|current release \(v0\.1\.11\)/);
  assert.match(notesSrc, /Compatibility Matrix/);
});

test('DEFAULT_RELEASE_NOTES provides rich markdown for current version', () => {
  const notesSrc = readFileSync(
    new URL('../frontend/features/about/config/releaseNotes.ts', import.meta.url),
    'utf-8'
  );

  assert.match(notesSrc, /Stage0 v0\.1\.11 Release Notes/);
  assert.match(notesSrc, /DEFAULT_RELEASE_NOTES/);
});

test('Backend exposes get_release_notes command and tauri.conf.json bundles RELEASE_NOTES.md', () => {
  const backendSrc = readFileSync(
    new URL('../backend/src/features/about/commands.rs', import.meta.url),
    'utf-8'
  );
  assert.match(backendSrc, /pub fn get_release_notes/);

  const tauriConf = readFileSync(
    new URL('../backend/tauri.conf.json', import.meta.url),
    'utf-8'
  );
  assert.match(tauriConf, /RELEASE_NOTES\.md/);
});
