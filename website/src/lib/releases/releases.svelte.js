import { releaseChannelFromTag } from './catalog.js';
import { fetchReleases, fetchLatestStable, readCache, writeCache } from './client.js';
import { detectDevice } from './platform.js';
import { downloadFor, recommendedKey, stableRecommendation } from './recommendation.js';

export function createReleases() {
  let catalog = $state([]);
  let latestStable = $state(null);
  let checkedLatest = false;
  const downloadCatalog = $derived(
    latestStable && !catalog.some((release) => release.tag_name === latestStable.tag_name)
      ? [...catalog, latestStable]
      : catalog,
  );
  let channel = $state('stable');
  let selectedTag = $state('');
  let device = $state({ os: 'unknown', arch: null, linuxKey: 'linuxAppImage' });
  let loading = $state(false);
  let loaded = $state(false);
  let error = $state('');
  let apiPage = $state(0);
  let hasMore = $state(true);
  const controller = new AbortController();
  let pending;
  const choices = $derived(
    downloadCatalog.filter((release) => releaseChannelFromTag(release.tag_name) === channel),
  );
  const selected = $derived(
    choices.find((release) => release.tag_name === selectedTag) || choices[0] || null,
  );
  const hero = $derived(stableRecommendation(downloadCatalog, device));
  const recommended = $derived.by(() => {
    const key = recommendedKey(device);
    if (downloadFor(selected, key).name) return key;
    return device.os === 'linux' &&
      device.arch === 'x64' &&
      downloadFor(selected, 'linuxAppImage').name
      ? 'linuxAppImage'
      : null;
  });

  async function load(older = false) {
    if (pending) return pending;
    if (loaded && !older) return;
    pending = (async () => {
      loading = true;
      error = '';
      try {
        if (!loaded) {
          const cache = readCache();
          if (cache) {
            catalog = cache.releases;
            apiPage = cache.apiPage;
            hasMore = cache.hasMore;
            loaded = true;
            return;
          }
        }
        const next = apiPage + 1;
        const result = await fetchReleases(next, controller.signal);
        const combined = new Map(
          [...catalog, ...result.releases].map((release) => [release.tag_name, release]),
        );
        catalog = [...combined.values()];
        apiPage = next;
        hasMore = result.hasMore;
        loaded = true;
        writeCache({ releases: $state.snapshot(catalog), apiPage, hasMore });
      } catch (failure) {
        if (!controller.signal.aborted) error = failure.message || 'Could not load releases.';
      } finally {
        loading = false;
      }
    })();
    try {
      await pending;
    } finally {
      pending = null;
    }
  }

  return {
    get catalog() {
      return catalog;
    },
    get channel() {
      return channel;
    },
    get choices() {
      return choices;
    },
    get selected() {
      return selected;
    },
    get hero() {
      return hero;
    },
    get device() {
      return device;
    },
    get recommended() {
      return recommended;
    },
    get loading() {
      return loading;
    },
    get loaded() {
      return loaded;
    },
    get error() {
      return error;
    },
    get hasMore() {
      return hasMore;
    },
    get status() {
      return (
        error ||
        (loading && !loaded
          ? 'Loading releases…'
          : selected
            ? `${selected.tag_name} · ${channel[0].toUpperCase() + channel.slice(1)} release`
            : `No ${channel} releases are available yet.`)
      );
    },
    selectChannel(value) {
      if (['stable', 'beta', 'nightly'].includes(value)) {
        channel = value;
        selectedTag = '';
      }
    },
    selectVersion(value) {
      selectedTag = value;
    },
    download(key) {
      return downloadFor(selected, key);
    },
    async load(older = false) {
      if (!loaded)
        void detectDevice().then((value) => {
          if (!controller.signal.aborted) device = value;
        });
      await load(older);
      // A quarterly stable can be older than the first 100 daily preview releases.
      // Keep it available for quick downloads without marking archive pages as loaded.
      if (
        loaded &&
        !checkedLatest &&
        !catalog.some((release) => releaseChannelFromTag(release.tag_name) === 'stable')
      ) {
        checkedLatest = true;
        try {
          const stable = await fetchLatestStable(controller.signal);
          if (!controller.signal.aborted) latestStable = stable;
        } catch {
          /* The archive still works; the hero safely links to GitHub latest. */
        }
      }
    },
    destroy() {
      controller.abort();
    },
  };
}
