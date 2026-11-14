import type { UiDensity } from '../types/UiDensity';
import type { PreferenceBootstrap } from '../types/PreferenceBootstrap';

export const DEFAULT_UI_DENSITY: UiDensity = 'standard';
export const UI_DENSITIES = ['standard', 'compact', 'touch'] as const;

export function normalizeUiDensity(value: unknown): UiDensity {
  return value === 'compact' || value === 'touch' ? value : DEFAULT_UI_DENSITY;
}

export function readUiDensity(settings?: PreferenceBootstrap): UiDensity {
  return normalizeUiDensity(settings?.appearance?.density);
}

export function densityGraphRowHeight(value: unknown): number {
  return { compact: 28, standard: 36, touch: 48 }[normalizeUiDensity(value)];
}
