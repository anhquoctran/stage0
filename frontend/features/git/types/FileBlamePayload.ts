import type { BlameCommit } from './BlameCommit';
import type { BlameLine } from './BlameLine';
import type { BlameAuthorStat } from './BlameAuthorStat';

export interface FileBlamePayload {
  file_path: string;
  revision: string;
  commits: Record<string, BlameCommit>;
  lines: BlameLine[];
  author_stats: BlameAuthorStat[];
  total_lines: number;
  current_user_name?: string | null;
  current_user_email?: string | null;
}
