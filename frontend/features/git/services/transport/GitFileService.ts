/** Feature-owned backend contract. Inputs retain the existing wire field names. */
export interface GitFileService {
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
