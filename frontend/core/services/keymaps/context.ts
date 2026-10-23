import { useGitStore } from '../../../features/git/store/useGitStore';
import { useVirtualMrStore } from '../../../features/virtual-mr/store/useVirtualMrStore';
import { usePreferencesStore } from '../../../features/preferences/store/usePreferencesStore';
import { getApplicationMenuFlags } from '../applicationMenuState';
import type { KeymapContext } from '../../types/keymaps/KeymapContext';

export function keymapsBlocked(includeDom = true): boolean {
  const git = useGitStore.getState();
  const mr = useVirtualMrStore.getState();
  return usePreferencesStore.getState().isPreferencesOpen || mr.isRepoSettingsOpen ||
    git.isCloneModalOpen || git.isPullFromOpen || git.isMergeFromOpen || git.isRebaseFromOpen ||
    git.isGitGraphOpen || git.isRepoOverviewOpen || git.isRemoteUrlFromOpen ||
    (includeDom && typeof document !== 'undefined' && Boolean(document.querySelector('[aria-modal="true"], [data-keymap-block], [role="menu"], [role="listbox"]')));
}
export function keymapContext(event: KeyboardEvent): KeymapContext {
  const target = event.target instanceof Element ? event.target : null;
  const editable = Boolean(target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]'));
  return {
    repository: Boolean(useGitStore.getState().currentRepo), editable,
    interactive: Boolean(target?.closest('button, a, [role="button"], [role="menu"], [role="listbox"], [role="combobox"]')),
    blocked: keymapsBlocked(), flags: { ...getApplicationMenuFlags() },
  };
}
