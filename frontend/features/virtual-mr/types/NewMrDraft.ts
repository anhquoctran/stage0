import type { VirtualMrCommit } from './VirtualMrCommit';

export interface NewMrDraft {
  baseBranch: string;
  compareBranch: string;
  title: string;
  description: string;
  selectedBots: string[];
  selectedLabels: string[];
  commits: VirtualMrCommit[];
  isCommitsLoading: boolean;
  commitsError: string | null;
}
