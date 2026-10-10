export interface RepositorySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'remotes' | 'branches' | 'labels' | 'agents';
}
