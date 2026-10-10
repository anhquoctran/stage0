export interface VirtualMrCommit {
  hash: string;
  shortHash: string;
  subject: string;
  body?: string;
  authorName: string;
  authorEmail: string;
  authoredDate: string;
}
