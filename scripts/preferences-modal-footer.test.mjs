import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadWithMocks } from './helpers/componentHarness.mjs';

const { PreferencesModalFooter } = loadWithMocks(
  new URL('../frontend/features/preferences/components/PreferencesModalFooter.tsx', import.meta.url),
  {
    react: { ...React, default: React },
    '../../../common/components/icons/RotateCcw': { RotateCcw: () => null },
    '../../../common/components/icons/Check': { Check: () => null },
  },
);

function footer(overrides = {}) {
  return PreferencesModalFooter({
    applyError: null,
    totalUnsaved: 1,
    hasUnsavedChanges: true,
    canCommitPreferences: true,
    isApplying: false,
    isApplied: false,
    onResetDefaultsPrompt() {},
    onCancel() {},
    onApply() {},
    onOk() {},
    ...overrides,
  });
}

function applyMarkup(overrides) {
  const html = renderToStaticMarkup(footer(overrides));
  return html.match(/<button\b[^>]*>(?:<span>(?:Apply|Applying…)<\/span>|<span>Applied<\/span>)<\/button>/u)?.[0];
}

test('Apply uses the shared primary button style instead of theme-dependent body text', () => {
  const button = applyMarkup();
  assert.ok(button);
  assert.match(button, /\bbtn-primary\b/);
  assert.match(button, /\brounded-sm\b/);
  assert.doesNotMatch(button, /bg-purple-|text-text|disabled/);
});

test('Apply remains disabled and neutral without unsaved changes', () => {
  const button = applyMarkup({
    totalUnsaved: 0,
    hasUnsavedChanges: false,
    canCommitPreferences: false,
  });
  assert.match(button, /disabled=""/);
  assert.match(button, /cursor-not-allowed/);
  assert.doesNotMatch(button, /btn-primary/);
});

test('Apply remains disabled while applying and shows its busy label', () => {
  const button = applyMarkup({ isApplying: true, canCommitPreferences: false });
  assert.match(button, /disabled=""/);
  assert.match(button, /Applying…/);
  assert.doesNotMatch(button, /btn-primary/);
});

test('Applied confirmation keeps its success styling', () => {
  const button = applyMarkup({
    totalUnsaved: 0,
    hasUnsavedChanges: false,
    canCommitPreferences: false,
    isApplied: true,
  });
  assert.match(button, /disabled=""/);
  assert.match(button, /text-green/);
  assert.match(button, />Applied</);
  assert.doesNotMatch(button, /btn-primary/);
});

test('footer preserves each transaction callback', () => {
  const calls = [];
  const tree = footer({
    onResetDefaultsPrompt: () => calls.push('reset'),
    onCancel: () => calls.push('cancel'),
    onApply: () => calls.push('apply'),
    onOk: () => calls.push('ok'),
  });
  function clickButtons(node) {
    if (Array.isArray(node)) return node.forEach(clickButtons);
    if (!node || typeof node !== 'object') return;
    if (node.type === 'button') node.props.onClick();
    clickButtons(node.props?.children);
  }
  clickButtons(tree);
  assert.deepEqual(calls, ['reset', 'cancel', 'apply', 'ok']);
});
