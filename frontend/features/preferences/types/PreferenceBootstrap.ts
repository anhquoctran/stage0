export interface PreferenceBootstrap {
  schemaVersion: number;
  general?: Record<string, unknown>;
  appearance?: Record<string, unknown>;
  ai?: Record<string, unknown>;
  reviewers?: unknown[];
  sandbox?: Record<string, unknown>;
  git?: Record<string, unknown>;
  notifications?: Record<string, unknown>;
  [key: string]: unknown;
}
