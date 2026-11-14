import { afterEach, expect, it, vi } from 'vitest';
import { applyUiDensityToDocument } from '../utils/applyUiDensityToDocument';
vi.mock('../services/preferencesJsonService', () => ({ preferencesJsonService: { patch: vi.fn() } }));
vi.mock('../services/preferencesWindowService', () => ({ requestPreferencesWindow: vi.fn() }));
import { usePreferencesStore } from './usePreferencesStore';

afterEach(() => {
  window.dispatchEvent(new CustomEvent('stage0-preferences-updated', { detail: { appearance: {} } }));
});

it('applies committed preference publications immediately to the window and reactive store', () => {
  for (const density of ['compact', 'touch', 'standard']) {
    window.dispatchEvent(new CustomEvent('stage0-preferences-updated', { detail: { appearance: { density } } }));
    expect(usePreferencesStore.getState().uiDensity).toBe(density);
    expect(document.documentElement).toHaveAttribute('data-ui-density', density);
  }
});

it('falls back to Standard for old documents and leaves font styles intact', () => {
  document.documentElement.style.setProperty('--viewer-font-size', '17px');
  document.documentElement.style.fontSize = '16px';
  for (const density of ['compact', 'touch', undefined, 'invalid']) applyUiDensityToDocument(density);
  expect(document.documentElement).toHaveAttribute('data-ui-density', 'standard');
  expect(document.documentElement.style.getPropertyValue('--viewer-font-size')).toBe('17px');
  expect(document.documentElement.style.fontSize).toBe('16px');
  window.dispatchEvent(new CustomEvent('stage0-preferences-updated', { detail: {} }));
  expect(usePreferencesStore.getState().uiDensity).toBe('standard');
  document.documentElement.style.removeProperty('font-size');
});
