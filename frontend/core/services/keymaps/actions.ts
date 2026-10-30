import { useGitStore } from '../../../features/git/store/useGitStore';
import { useVirtualMrStore } from '../../../features/virtual-mr/store/useVirtualMrStore';
import { executeMenuAction } from '../applicationMenuActions';
import { MENU_COMMANDS } from '../../constants/applicationMenu';
import type { MenuCallbacks } from '../../types/menu/MenuCallbacks';

export async function executeKeymapCommand(id: string, callbacks: MenuCallbacks): Promise<void> {
  if (Object.hasOwn(MENU_COMMANDS, id)) return executeMenuAction(id, callbacks);
  try { await runWorkspaceCommand(id); }
  catch (error) {
    useGitStore.getState().showToast(i18n.t('menu.toasts.shortcutFailed', { error: error instanceof Error ? error.message : String(error) }), 'error');
  }
}

async function runWorkspaceCommand(id: string): Promise<void> {
  const git = useGitStore.getState();
  if (id.startsWith('recent_') && !git.currentRepo) {
    const repository = git.recentRepos[Number(id.slice(7)) - 1];
    if (repository) await git.selectRepo(repository);
    return;
  }
  if (!git.currentRepo) return;
  const mr = useVirtualMrStore.getState();
  if (id === 'next_conflict') git.selectNextConflictFile();
  if (id === 'close_tab') {
    if (mr.isDraftActive) mr.closeNewMrDraft();
    else if (mr.activeSessionId) await mr.closeSession(mr.activeSessionId);
  }
  if (/^tab_[1-9]$/.test(id)) {
    const visible = mr.sessions.filter((session) => !mr.closedSessionTabIds.includes(session.id));
    const session = visible[Number(id.slice(4)) - 1];
    if (session) {
      mr.switchSession(session.id);
      await git.setBranchComparison(session.baseBranch, session.compareBranch);
    }
  }
}
import i18n from '../../../features/i18n/i18n';
