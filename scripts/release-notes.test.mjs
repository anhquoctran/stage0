import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { loadWithMocks } from './helpers/componentHarness.mjs';

const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('MenuBarHelpMenu renders View release notes menu item above About Stage0', () => {
  const menuSrc = readFileSync(
    new URL('../shared/application-menu.json', import.meta.url),
    'utf-8'
  );

  const menu = JSON.parse(menuSrc);
  const help = menu.menus.find((node) => node.id === 'help_menu');
  const releaseNotesIndex = help.items.findIndex((node) => node.command === 'release_notes');
  const aboutIndex = help.items.findIndex((node) => node.command === 'about');

  assert.ok(releaseNotesIndex !== -1, 'View release notes menu item must exist');
  assert.ok(aboutIndex !== -1, 'About Stage0 menu item must exist');
  assert.ok(
    releaseNotesIndex < aboutIndex,
    'View release notes must be positioned above About Stage0'
  );
  assert.equal(menu.commands.release_notes.label, 'View release notes');
  assert.equal(menu.commands.about.label, 'About Stage0');
  const actions = readFileSync(new URL('../frontend/core/services/applicationMenuActions.ts', import.meta.url), 'utf8');
  assert.match(actions, /release_notes:\s*callbacks.onOpenReleaseNotes/);
});

test('MenuBar wires showReleaseNotesModal state and mounts ReleaseNotesModal', () => {
  const menuBarSrc = readFileSync(
    new URL('../frontend/core/components/layout/MenuBar.tsx', import.meta.url),
    'utf-8'
  );

  assert.match(menuBarSrc, /showReleaseNotesModal/);
  assert.match(menuBarSrc, /onOpenReleaseNotes:\s*\(\)\s*=>\s*setShowReleaseNotesModal\(true\)/);
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

test('RELEASE_NOTES.md exists and is scoped to the current package version', () => {
  const filePath = new URL('../RELEASE_NOTES.md', import.meta.url);
  assert.ok(existsSync(filePath), 'RELEASE_NOTES.md must exist in root');

  const notesSrc = readFileSync(filePath, 'utf-8');
  assert.match(notesSrc, new RegExp(`Stage0 v${escapeRegex(version)} Release Notes`));
  assert.match(notesSrc, new RegExp(`Current Version Release Notes|current release \\(v${escapeRegex(version)}\\)`));
  assert.match(notesSrc, /Compatibility Matrix/);
});

test('DEFAULT_RELEASE_NOTES provides rich markdown for current version', () => {
  const { DEFAULT_RELEASE_NOTES } = loadWithMocks(new URL('../frontend/features/about/config/releaseNotes.ts', import.meta.url), {});
  assert.match(DEFAULT_RELEASE_NOTES, new RegExp(`Stage0 v${escapeRegex(version)} Release Notes`));
  assert.equal(DEFAULT_RELEASE_NOTES, readFileSync(new URL('../RELEASE_NOTES.md', import.meta.url), 'utf8'));
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
