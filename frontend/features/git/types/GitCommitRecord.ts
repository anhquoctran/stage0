/** Backend commit record; field names and nullability follow GitCommitItem. */
export interface GitCommitRecord {
  hash: string;
  short_hash: string;
  subject: string;
  body: string | null;
  author_name: string;
  author_email: string;
  authored_date: string;
}
