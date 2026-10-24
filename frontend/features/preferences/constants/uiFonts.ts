export const DEFAULT_UI_FONT_FAMILY = 'IBM Plex Sans';

// These fonts are shipped via @fontsource imports in frontend/main.tsx.
// Keep code fonts available, but place them after the general-purpose UI fonts.
export const RECOMMENDED_UI_FONT_FAMILIES = [
  DEFAULT_UI_FONT_FAMILY,
  'Inter Variable',
  'Roboto Variable',
] as const;

export const LOW_PRIORITY_UI_FONT_FAMILIES = [
  'Fira Code',
  'JetBrains Mono',
] as const;

export const BUNDLED_UI_FONT_FAMILIES = [
  ...RECOMMENDED_UI_FONT_FAMILIES,
  'Fira Code',
] as const;
