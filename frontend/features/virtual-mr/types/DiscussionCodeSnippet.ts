export interface DiscussionCodeSnippet {
  startLine: number;
  selectedLine?: number;
  selectedEndLine?: number;
  format?: 'diff' | 'plain';
  lines: string[];
}
