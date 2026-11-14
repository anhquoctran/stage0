export interface LocalContextCacheStatus {
  modelReady: boolean;
  installing: boolean;
  cacheBytes: number;
  modelBytes: number;
  downloadBytes: number;
}
