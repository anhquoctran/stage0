export interface MainLayoutModalsProps {
  isRepoSettingsOpen: boolean;
  closeRepoSettings: () => void;
  repoSettingsActiveTab: 'branches' | 'remotes' | 'labels' | 'agents';
}
