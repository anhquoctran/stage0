export interface ConflictedFileInfo {
  path: string;
  conflict_type: string;
  message: string;
  conflict_markers_count?: number;
}
