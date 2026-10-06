export interface SupportedFont {
  fontFamilyName: string;
  ligaturesSupport: boolean;
}

export const SUPPORTED_FONTS: SupportedFont[] = [
  {
    fontFamilyName: 'JetBrains Mono',
    ligaturesSupport: true,
  },
  {
    fontFamilyName: 'Fira Code',
    ligaturesSupport: true,
  },
  {
    fontFamilyName: 'Cascadia Code',
    ligaturesSupport: true,
  },
  {
    fontFamilyName: 'Source Code Pro',
    ligaturesSupport: false,
  },
  {
    fontFamilyName: 'Hack',
    ligaturesSupport: false,
  },
  {
    fontFamilyName: 'Iosevka',
    ligaturesSupport: true,
  },
  {
    fontFamilyName: 'IBM Plex Mono',
    ligaturesSupport: false,
  },
  {
    fontFamilyName: 'Monaspace',
    ligaturesSupport: true,
  },
  {
    fontFamilyName: 'Victor Mono',
    ligaturesSupport: true,
  },
  {
    fontFamilyName: 'Geist Mono',
    ligaturesSupport: false,
  },
];
