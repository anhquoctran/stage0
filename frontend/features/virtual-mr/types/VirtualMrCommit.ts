export interface VirtualMrCommit {
  hash: string;
  shortHash: string;
  subject: string;
  body?: string | null;
  authorName: string;
  authorEmail: string;
  authoredDate: string;
}
