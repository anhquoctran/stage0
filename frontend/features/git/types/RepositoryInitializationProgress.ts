export interface RepositoryInitializationProgress {
  phase: 'catalog' | 'workspace';
  completed: number;
  total: number;
}
