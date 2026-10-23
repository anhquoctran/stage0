export interface KeymapSettings {
  preset: string;
  // An empty key list explicitly unbinds a command. Omission inherits its preset.
  overrides: { command: string; keys: string[] }[];
}
