export interface KeymapCommand {
  id: string;
  label: string;
  scope: 'application' | 'workspace' | 'tabs' | 'welcome';
  keys: string[];
  editable: boolean;
  repeatable?: boolean;
  requires: string[];
}
