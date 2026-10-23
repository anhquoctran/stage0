// Values describe UI availability, not permission to perform an operation.
export interface MenuFlags {
  repository: boolean;
  file: boolean;
  textFile: boolean;
  idle: boolean;
  rebasing: boolean;
  recents: boolean;
  split: boolean;
  unified: boolean;
  blame: boolean;
  inlineBlame: boolean;
  flat: boolean;
  tree: boolean;
  performance: boolean;
}
