import type { ConflictRegion } from './ConflictRegion';

export interface ConflictFilePreview {
  file_path: string;
  base_branch: string;
  compare_branch: string;
  conflict_type: string;
  has_conflict_markers: boolean;
  conflict_markers_count: number;
  merged_content: string;
  base_content?: string | null;
  compare_content?: string | null;
  conflict_regions: ConflictRegion[];
}
