export interface BlameCommit {
  commit_id: string;
  author: string;
  author_mail: string;
  author_time: number;
  author_tz: string;
  committer: string;
  committer_mail: string;
  committer_time: number;
  summary: string;
  previous_commit?: string | null;
}
