/** Feature-owned backend contract. Inputs retain the existing wire field names. */
export interface SystemFontService {
  listSystemFontFamilies(): Promise<string[]>;
}
