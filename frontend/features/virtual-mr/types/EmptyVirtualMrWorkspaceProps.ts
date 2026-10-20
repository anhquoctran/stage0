export interface EmptyVirtualMrWorkspaceProps {
  onNewMr: () => void;
  onShowSavedMrs?: () => void;
  hasSavedMrs?: boolean;
  repoName?: string;
  defaultBaseBranch?: string;
}
