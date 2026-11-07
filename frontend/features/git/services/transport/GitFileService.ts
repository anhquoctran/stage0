/** Feature-owned backend contract. Inputs retain the existing wire field names. */
import type { FileTextDiff } from '../../types/FileTextDiff';

export interface GitFileService {
  getFileTextDiff(input: {
    repoPath: string; oldRef: string | null; newRef: string; filePath: string;
    oldPath: string | null; encoding: string | null;
  }): Promise<FileTextDiff>;
  openFileInEditor(input: {
    repoPath: string;
    filePath: string;
    lineNumber: number | null;
  }): Promise<unknown>;
  openRepoIn(input: {
    repoPath: string;
    target: "explorer" | "vscode" | "terminal";
  }): Promise<unknown>;
  revealFileInOs(input: {
    repoPath: string;
    filePath: string;
  }): Promise<unknown>;
}
