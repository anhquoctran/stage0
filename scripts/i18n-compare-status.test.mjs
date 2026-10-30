import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadWithMocks } from './helpers/componentHarness.mjs';
import en from '../frontend/features/i18n/locales/en.json' with { type: 'json' };
import vi from '../frontend/features/i18n/locales/vi.json' with { type: 'json' };

let catalog = en;
let state = {};
const { StatusBarCompareStatus } = loadWithMocks(new URL('../frontend/core/components/layout/status-bar/StatusBarCompareStatus.tsx', import.meta.url), {
  react: { ...React, default: React },
  'react-i18next': { useTranslation: () => ({ t: key => key.split('.').reduce((value, part) => value?.[part], catalog) }) },
  '../../../../features/git/store/useGitStore': { useGitStore: () => state },
  '../../../../common/components/icons/ShieldCheck': { ShieldCheck: () => null },
  '../../../../common/components/icons/AlertTriangle': { AlertTriangle: () => null },
  '../../../../common/components/icons/Loader2': { Loader2: () => null },
  '../../../../common/components/icons/Info': { Info: () => null },
});

test('comparison state and tooltip use the current UI language', () => {
  state = { diffPayload: { files: [] } };
  catalog = en;
  assert.match(renderToStaticMarkup(StatusBarCompareStatus({ isVisible: true })), /No changes/);
  catalog = vi;
  const markup = renderToStaticMarkup(StatusBarCompareStatus({ isVisible: true }));
  assert.match(markup, /title="Không có thay đổi"/);
  assert.match(markup, />Không có thay đổi</);
  state = { isDiffLoading: true };
  assert.match(renderToStaticMarkup(StatusBarCompareStatus({ isVisible: true })), /Đang so sánh/);
});
