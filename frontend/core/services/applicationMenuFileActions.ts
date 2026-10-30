import { useGitStore } from '../../features/git/store/useGitStore';
import i18n from '../../features/i18n/i18n';
import {
  revealInOs,
  getAbsoluteFilePath,
  buildRemoteFileUrl,
  openRepoInTerminal,
  openRepoInVsCode,
  openRepoInExplorer,
  getOsFileManagerName,
} from '../../features/git/utils/fileActions';

export async function runMenuFileAction(id: string) {
  const git = useGitStore.getState();
  const { currentRepo: repo, selectedFile: file, showToast } = git;
  if (!repo) return;
  switch (id) {
    case 'open_terminal':
      await openRepoInTerminal(repo.local_path);
      showToast(i18n.t('menu.toasts.openedInTerminal'));
      break;
    case 'open_vscode':
      try {
        await openRepoInVsCode(repo.local_path);
        showToast(i18n.t('menu.toasts.openedInVsCode'), 'success');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        showToast(msg, 'error');
      }
      break;
    case 'open_explorer':
      await openRepoInExplorer(repo.local_path);
      showToast(i18n.t('menu.toasts.openedInFileManager', { name: getOsFileManagerName() }));
      break;
    case 'reveal_file':
      if (!file) return;
      await revealInOs(repo.local_path, file.path);
      showToast(i18n.t('menu.toasts.revealedFile'));
      break;
    case 'copy_rel_path':
      if (!file) return;
      await navigator.clipboard.writeText(file.path);
      showToast(i18n.t('menu.toasts.copiedRelativePath', { path: file.path }));
      break;
    case 'copy_abs_path':
      if (!file) return;
      await navigator.clipboard.writeText(getAbsoluteFilePath(repo.local_path, file.path));
      showToast(i18n.t('menu.toasts.copiedAbsolutePath'));
      break;
    case 'copy_remote_url': {
      if (!file) return;
      const remote = git.remoteUrl || `https://github.com/${repo.name}`;
      const ref = git.compareBranch || 'main';
      await navigator.clipboard.writeText(buildRemoteFileUrl(remote, ref, file.path));
      showToast(i18n.t('menu.toasts.copiedRemoteUrl', { ref }));
      break;
    }
    case 'copy_remote_url_from':
      if (!file) return;
      git.setTargetFileForUrl(file);
      git.setIsRemoteUrlFromOpen(true);
      break;
  }
}
