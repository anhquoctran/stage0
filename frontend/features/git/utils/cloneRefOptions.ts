import type { CustomSelectOption } from '../../../common/types/CustomSelectOption';
import type { RemoteCloneRefs } from '../types/RemoteCloneRefs';

export function cloneRefOptions(refs: RemoteCloneRefs): CustomSelectOption<string>[] {
  const branchNames = new Set(refs.branches);
  return [
    { value: '', label: refs.defaultBranch ? `Remote default branch (${refs.defaultBranch})` : 'Remote default branch', group: 'Default' },
    ...refs.branches.map((name) => ({ value: name, label: name, group: 'Branches', badge: name === refs.defaultBranch ? 'default' : undefined })),
    ...refs.tags.map((name) => ({ value: branchNames.has(name) ? `tag:${name}` : name, label: name, group: 'Tags',
      disabled: branchNames.has(name), description: branchNames.has(name) ? 'A branch has this name; Git clone would select the branch instead.' : undefined })),
  ];
}
