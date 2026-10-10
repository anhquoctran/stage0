import { type ConflictReport } from './ConflictReport';

export interface ConflictBannerProps {
  conflictReport: ConflictReport | null;
  onSelectConflictFile?: (filePath: string) => void;
}
