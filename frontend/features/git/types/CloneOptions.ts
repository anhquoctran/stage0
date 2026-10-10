export interface CloneOptions {
  branch: string;
  depth: number | null;
  singleBranch: boolean;
  noTags: boolean;
  blobless: boolean;
  sparse: boolean;
  recurseSubmodules: boolean;
  shallowSubmodules: boolean;
  filterSubmodules: boolean;
  submoduleJobs: number;
  skipLfs: boolean;
  timeoutMinutes: number;
}
