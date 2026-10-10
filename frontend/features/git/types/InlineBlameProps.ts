import { type BlameCommit } from './BlameCommit';

export interface InlineBlameProps {
  commit: BlameCommit | null;
  lineNo: number;
  currentUser?: { name?: string | null; email?: string | null };
  remoteUrl?: string | null;
  onOpenFullBlame?: () => void;
  showToast?: (msg: string) => void;
}
