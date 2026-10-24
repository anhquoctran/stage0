import { FolderGit2 } from '../../../common/components/icons/FolderGit2';
import { DownloadCloud } from '../../../common/components/icons/DownloadCloud';
import { BranchArtwork } from './BranchArtwork';

export function WelcomeRepositoryPreview() {
  return <div className="space-y-5 rounded-sm">
    <div className="rounded-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-brand">Your next review starts here</p>
      <h2 className="mt-3 text-2xl font-semibold text-text">Bring your project into focus.</h2>
      <p className="mt-3 text-sm leading-6 text-subtext1">Once your repository is open, choose two branches to compare.</p>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div className="flex items-center gap-3 rounded-sm bg-base p-4 text-sm text-text">
        <FolderGit2 aria-hidden="true" className="h-5 w-5 shrink-0 text-brand" /> Local repository
      </div>
      <div className="flex items-center gap-3 rounded-sm bg-base p-4 text-sm text-text">
        <DownloadCloud aria-hidden="true" className="h-5 w-5 shrink-0 text-brand" /> Remote repository
      </div>
    </div>
    <div className="space-y-2 rounded-sm">
      <p className="text-xs text-subtext0">Example review workspace</p>
      <BranchArtwork />
    </div>
  </div>;
}
