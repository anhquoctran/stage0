export interface KeymapContext {
  repository: boolean;
  editable: boolean;
  interactive: boolean;
  blocked: boolean;
  flags: Record<string, boolean>;
}
