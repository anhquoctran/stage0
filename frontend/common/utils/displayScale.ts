/** DPI changes raster resolution, never CSS layout sizes or Density. */
export function normalizeDisplayScale(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.min(8, Math.max(1, value)) : 1;
}

export function readDisplayScale(): number {
  return normalizeDisplayScale(typeof window === 'undefined' ? 1 : window.devicePixelRatio);
}

const subscribers = new Set<() => void>();
let stopWatching: (() => void) | undefined;

/** One event-driven watcher per document, shared by all subscribers. No polling. */
export function subscribeDisplayScale(callback: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return () => {};
  const listener = () => callback();
  subscribers.add(listener);
  if (!stopWatching) {
    const target = window;
    let previous = readDisplayScale();
    let removeQuery = () => {};
    const watchResolution = () => {
      removeQuery();
      if (typeof target.matchMedia !== 'function') return;
      // Re-arm after every change: a query for the old resolution fires only
      // when crossing that resolution, not for every later monitor transition.
      const query = target.matchMedia(`(resolution: ${target.devicePixelRatio || 1}dppx)`);
      if (typeof query.addEventListener === 'function') {
        query.addEventListener('change', changed);
        removeQuery = () => query.removeEventListener('change', changed);
      } else if (typeof query.addListener === 'function') {
        query.addListener(changed);
        removeQuery = () => query.removeListener(changed);
      }
    };
    const changed = () => {
      const next = readDisplayScale();
      if (next === previous) return;
      previous = next;
      watchResolution();
      for (const subscriber of [...subscribers]) subscriber();
    };
    watchResolution();
    target.addEventListener('resize', changed);
    target.visualViewport?.addEventListener('resize', changed);
    stopWatching = () => {
      removeQuery();
      target.removeEventListener('resize', changed);
      target.visualViewport?.removeEventListener('resize', changed);
    };
  }
  return () => {
    subscribers.delete(listener);
    if (!subscribers.size) {
      stopWatching?.();
      stopWatching = undefined;
    }
  };
}
