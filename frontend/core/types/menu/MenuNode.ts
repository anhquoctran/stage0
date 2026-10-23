export interface MenuNode {
  id?: string;
  label?: string;
  description?: string;
  icon?: string;
  command?: string;
  separator?: boolean;
  dynamic?: string;
  requires?: string[];
  platforms?: string[];
  items?: MenuNode[];
}
