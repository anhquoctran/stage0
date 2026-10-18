export interface ReviewFinding {
  filePath: string;
  side: 'base' | 'head';
  startLine: number;
  endLine: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  body: string;
  evidence: string;
}
