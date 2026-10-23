export interface MenuCommand {
  label: string;
  shortcut?: string;
  native?: string;
  requires?: string[];
  checked?: string;
  icon?: string;
}
