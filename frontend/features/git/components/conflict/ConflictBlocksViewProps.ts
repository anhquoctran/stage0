import type { ConflictRegion } from '../../types/ConflictRegion';
export interface ConflictBlocksViewProps {
  regions: ConflictRegion[];
  baseBranch: string;
  handleCopy: (text: string, key: string) => void;
  copiedKey: string | null;
  fontFamily: string;
  fontSize: number;
  lineSpacing: number;
  enableLigatures: boolean;
  compareBranch: string;
}
