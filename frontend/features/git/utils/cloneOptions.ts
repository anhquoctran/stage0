import type { CloneOptions } from '../types/CloneOptions';

export function createCloneOptions(): CloneOptions {
  return {
    branch: '', depth: null,
    singleBranch: false, noTags: false, blobless: false, sparse: false,
    recurseSubmodules: true, shallowSubmodules: false, filterSubmodules: false,
    submoduleJobs: 4, skipLfs: false, timeoutMinutes: 60,
  };
}

export function validateCloneOptions(options: CloneOptions): string | null {
  if (options.depth !== null && (!Number.isInteger(options.depth) || options.depth < 1 || options.depth > 1_000_000)) {
    return 'Clone depth must be a whole number between 1 and 1,000,000.';
  }
  if (!Number.isInteger(options.submoduleJobs) || options.submoduleJobs < 1 || options.submoduleJobs > 32) {
    return 'Submodule parallel jobs must be a whole number between 1 and 32.';
  }
  if (!Number.isInteger(options.timeoutMinutes) || options.timeoutMinutes < 1 || options.timeoutMinutes > 1440) {
    return 'Clone timeout must be a whole number between 1 and 1,440 minutes.';
  }
  if (options.shallowSubmodules && !options.recurseSubmodules) return 'Enable recursive submodules before shallow submodules.';
  if (options.filterSubmodules && !(options.recurseSubmodules && options.blobless)) return 'Submodule filtering requires recursive submodules and partial clone.';
  const branch = options.branch.trim();
  if (branch && (branch.length > 1024 || branch.startsWith('-') || /[\x00-\x20\x7f~^:?*\[\\@]/.test(branch)
    || branch.includes('..') || branch.includes('//') || branch.startsWith('/') || branch.endsWith('/')
    || branch.split('/').some((part) => part.startsWith('.') || part.endsWith('.lock')) || branch.endsWith('.'))) {
    return 'Enter a valid branch or tag name, not Git command options.';
  }
  return null;
}

/** Display only; execution uses individually validated arguments in Rust, never a shell. */
export function previewCloneCommand(url: string, destination: string, options: CloneOptions): string {
  const quote = (value: string) => JSON.stringify(value);
  const args = ['git', 'clone', '--progress'];
  if (options.branch.trim()) args.push(`--branch=${quote(options.branch.trim())}`);
  if (options.depth !== null) args.push(`--depth=${options.depth}`);
  args.push(options.singleBranch ? '--single-branch' : '--no-single-branch');
  if (options.noTags) args.push('--no-tags');
  if (options.blobless) args.push('--filter=blob:none');
  if (options.sparse) args.push('--sparse');
  if (options.recurseSubmodules) {
    args.push('--recurse-submodules', `--jobs=${options.submoduleJobs}`);
    if (options.shallowSubmodules) args.push('--shallow-submodules');
    if (options.filterSubmodules) args.push('--also-filter-submodules');
  }
  args.push('--', url.trim() ? quote(url.trim()) : '<url>', destination.trim() ? quote(destination.trim()) : '<destination>');
  return args.join(' ');
}
