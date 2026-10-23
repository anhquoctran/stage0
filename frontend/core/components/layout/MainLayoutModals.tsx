import { CloneRepoModal } from '../../../features/git/components/CloneRepoModal';
import { GitTaskDialog } from '../../../features/git/components/GitTaskDialog';
import { MergeFromModal } from '../../../features/git/components/MergeFromModal';
import { PullFromModal } from '../../../features/git/components/PullFromModal';
import { RebaseFromModal } from '../../../features/git/components/RebaseFromModal';
import { RemoteUrlFromModal } from '../../../features/git/components/RemoteUrlFromModal';
import { RepositoryOverviewModal } from '../../../features/git/components/RepositoryOverviewModal';
import { RepositorySettingsModal } from '../../../features/git/components/RepositorySettingsModal';
import { PreferencesModal } from '../../../features/preferences/components/PreferencesModal';
import type { MainLayoutModalsProps } from './MainLayoutModalsProps';

export function MainLayoutModals({
  isRepoSettingsOpen,
  closeRepoSettings,
  repoSettingsActiveTab,
}: MainLayoutModalsProps) {
  return (
    <>
      {/* Repository Settings Dialog */}
      <RepositorySettingsModal
        isOpen={isRepoSettingsOpen}
        onClose={closeRepoSettings}
        initialTab={repoSettingsActiveTab}
      />

      {/* Preferences Modal Dialog */}
      <PreferencesModal />

      {/* Pull From Remote Modal Dialog */}
      <PullFromModal />

      {/* Rebase From Branch Modal Dialog */}
      <RebaseFromModal />

      {/* Merge From Branch Modal Dialog */}
      <MergeFromModal />

      {/* Remote URL From Branch/Commit Modal Dialog */}
      <RemoteUrlFromModal />

      {/* Clone Remote Repository Modal Dialog */}
      <CloneRepoModal />
      {/* Repository Overview Modal Dialog */}
      <RepositoryOverviewModal />

      <GitTaskDialog />
    </>
  );
}
