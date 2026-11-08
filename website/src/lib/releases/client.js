import { API_URL, sanitizeReleases } from './catalog.js';

const TTL = 10 * 60 * 1000;
const CACHE_KEY = 'stage0_release_history_v3';

export function readCache(storage, now = Date.now()) {
  try {
    storage ??= globalThis.localStorage;
    const cache = JSON.parse(storage.getItem(CACHE_KEY));
    if (
      !cache ||
      !Number.isFinite(cache.timestamp) ||
      !Array.isArray(cache.releases) ||
      now - cache.timestamp >= TTL ||
      cache.timestamp > now ||
      !Number.isInteger(cache.apiPage) ||
      cache.apiPage < 1
    )
      return null;
    return {
      releases: sanitizeReleases(cache.releases),
      apiPage: cache.apiPage,
      hasMore: Boolean(cache.hasMore),
    };
  } catch {
    return null;
  }
}

export function writeCache(state, storage) {
  try {
    storage ??= globalThis.localStorage;
    // Store whole API pages only; truncating a page would permanently skip releases.
    if (state.releases.length <= 500)
      storage.setItem(CACHE_KEY, JSON.stringify({ ...state, timestamp: Date.now() }));
  } catch {
    /* Browsing still works when storage is unavailable. */
  }
}

async function fetchJson(url, signal, fetcher) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    const request = new AbortController();
    const cancel = () => request.abort(signal.reason);
    if (signal.aborted) cancel();
    signal.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(() => request.abort(new Error('GitHub request timed out.')), 12000);
    try {
      const response = await fetcher(url, {
        signal: request.signal,
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!response.ok) {
        const error = new Error(
          response.status === 403 || response.status === 429
            ? 'GitHub rate limit reached. Please try again later.'
            : `GitHub returned HTTP ${response.status}.`,
        );
        if (response.status < 500) throw Object.assign(error, { permanent: true });
        throw error;
      }
      return await response.json();
    } catch (error) {
      if (signal.aborted || error.permanent) throw error;
      lastError = error;
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
    }
  }
  throw lastError;
}

export async function fetchReleases(page, signal, fetcher = globalThis.fetch) {
  const data = await fetchJson(`${API_URL}?per_page=100&page=${page}`, signal, fetcher);
  if (!Array.isArray(data)) throw new Error('Invalid release response.');
  return { releases: sanitizeReleases(data), hasMore: data.length === 100 };
}

export async function fetchLatestStable(signal, fetcher = globalThis.fetch) {
  const data = await fetchJson(`${API_URL}/latest`, signal, fetcher);
  return (
    sanitizeReleases([data]).find((release) => /^v\d+\.\d+\.\d+$/.test(release.tag_name)) || null
  );
}
