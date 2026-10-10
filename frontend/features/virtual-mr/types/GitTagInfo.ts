export interface GitTagInfo {
  name: string;
  commit_hash: string;
  message?: string | null;
  date?: string | null;
}
