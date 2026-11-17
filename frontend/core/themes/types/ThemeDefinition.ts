export interface ThemeDefinition {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly name: string;
  readonly kind: 'dark' | 'light';
  readonly version: string;
  readonly author?: string;
  readonly colors: Readonly<Record<string, string>>;
}
