// Automatically loaded, filterable release archive with client-side pagination.
(function () {
  'use strict';

  const stage0 = window.stage0 || window.Stage0;
  const GITHUB_REPO = stage0?.getConstant('GITHUB_REPO', 'anhquoctran/stage0') || 'anhquoctran/stage0';
  const RELEASES_LIST_API_URL = stage0?.getConstant(
    'RELEASES_LIST_API_URL',
    `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=100`
  ) || `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=100`;
  const CACHE_KEY = 'stage0_release_history_v3';
  const SHARED_RELEASES_CACHE_KEY = stage0?.getConstant('RELEASES_LIST_CACHE_KEY', 'stage0_release_list_cache') || 'stage0_release_list_cache';
  const CACHE_TTL_MS = 10 * 60 * 1000;
  const PAGE_SIZE = 10;
  const API_PAGE_SIZE = 100;
  const MAX_CACHED_RELEASES = 500;
  const releaseManager = stage0?.modules?.releases || stage0?.releases;

  const state = {
    releases: [],
    apiPage: 0,
    hasMore: true,
    loaded: false,
    loading: false,
    error: false,
    page: 1,
    os: 'all',
    arch: 'all',
  };

  const elements = {};

  function byId(id) {
    return elements[id] || (elements[id] = document.getElementById(id));
  }

  function channelForTag(tag) {
    if (typeof releaseManager?.releaseChannelFromTag === 'function') {
      return releaseManager.releaseChannelFromTag(tag);
    }
    if (/^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(String(tag || ''))) return 'stable';
    const match = String(tag || '').match(/^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)-(nightly|beta)\.[1-9]\d{7}\.(?:0|[1-9]\d*)$/);
    return match?.[1] || null;
  }

  function classifyAsset(asset) {
    const name = String(asset?.name || '');
    const url = String(asset?.browser_download_url || '');
    if (!name || name.endsWith('.sig') || !isTrustedReleaseUrl(url)) return null;

    const target = name.toLowerCase();
    let os;
    let arch;
    let format;
    let formatLabel;

    if (target.includes('pc-windows-msvc') && target.endsWith('.exe')) {
      os = 'windows';
      arch = target.includes('aarch64') ? 'arm64' : target.includes('x86_64') ? 'x64' : null;
      format = '.exe';
      formatLabel = 'EXE';
    } else if (target.includes('apple-darwin') && target.endsWith('.dmg')) {
      os = 'macos';
      arch = target.includes('aarch64') ? 'arm64' : target.includes('x86_64') ? 'x64' : null;
      format = '.dmg';
      formatLabel = 'DMG';
    } else if (target.includes('unknown-linux-gnu')) {
      os = 'linux';
      arch = target.includes('aarch64') ? 'arm64' : target.includes('x86_64') ? 'x64' : null;
      if (target.endsWith('.appimage')) {
        format = '.AppImage';
        formatLabel = 'APPIMAGE';
      } else if (target.endsWith('.deb')) {
        format = '.deb';
        formatLabel = 'DEB';
      } else if (target.endsWith('.rpm')) {
        format = '.rpm';
        formatLabel = 'RPM';
      }
    }

    if (!os || !arch || !format) return null;
    const osLabels = { windows: 'Windows', macos: 'macOS', linux: 'Linux' };
    const archLabels = { x64: 'AMD64', arm64: 'ARM64' };
    return {
      name,
      url,
      size: formatAssetSize(asset?.size),
      digest: formatAssetDigest(asset?.digest),
      os,
      arch,
      format,
      osLabel: osLabels[os],
      archLabel: archLabels[arch],
      iconClass: { windows: 'fa-brands fa-windows', macos: 'fa-brands fa-apple', linux: 'fa-brands fa-linux' }[os],
      formatLabel,
      label: `${osLabels[os]} ${archLabels[arch]} · ${formatLabel}`,
    };
  }

  function formatAssetSize(value) {
    const bytes = Number(value);
    if (!Number.isFinite(bytes) || bytes <= 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`;
    const unit = bytes >= 1024 ** 3 ? 'GB' : 'MB';
    const divisor = unit === 'GB' ? 1024 ** 3 : 1024 ** 2;
    return `${(bytes / divisor).toFixed(1).replace(/\.0$/, '')} ${unit}`;
  }

  function formatAssetDigest(value) {
    const match = String(value || '').trim().match(/^sha256:([a-f\d]{64})$/i);
    return match ? match[1].toLowerCase() : '';
  }

  function isTrustedReleaseUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:'
        && url.hostname === 'github.com'
        && url.pathname.startsWith(`/` + GITHUB_REPO + `/releases/`);
    } catch {
      return false;
    }
  }

  function sanitizeRelease(release) {
    if (!release?.tag_name || !channelForTag(release.tag_name)) return null;
    const htmlUrl = isTrustedReleaseUrl(release.html_url) ? release.html_url : '';
    const assets = Array.isArray(release.assets)
      ? release.assets.map(asset => ({
        name: asset.name,
        browser_download_url: asset.browser_download_url,
        size: asset.size,
        digest: asset.digest,
      }))
      : [];
    return {
      tag_name: String(release.tag_name),
      html_url: htmlUrl,
      published_at: release.published_at || release.created_at || '',
      assets,
    };
  }

  function filteredAssets(release) {
    return (release.assets || []).map(classifyAsset).filter(asset => asset
      && (state.os === 'all' || asset.os === state.os)
      && (state.arch === 'all' || asset.arch === state.arch))
      .sort((left, right) => {
        const osOrder = { linux: 0, macos: 1, windows: 2 };
        const architectureOrder = { arm64: 0, x64: 1 };
        return osOrder[left.os] - osOrder[right.os]
          || architectureOrder[left.arch] - architectureOrder[right.arch]
          || left.formatLabel.localeCompare(right.formatLabel, 'en');
      });
  }

  function filteredReleases() {
    return state.releases.filter(release => filteredAssets(release).length > 0);
  }

  function updateFilterButtons(attribute, selectedValue) {
    document.querySelectorAll(`[${attribute}]`).forEach(button => {
      const active = button.getAttribute(attribute) === selectedValue;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function setStatus(message) {
    const status = byId('release-history-status');
    if (status) status.textContent = message;
  }

  function formatReleaseDate(value) {
    if (!value) return 'Date unavailable';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Date unavailable';
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  async function copyDigestToClipboard(digest) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(digest);
      setStatus('SHA-256 digest copied to clipboard.');
    } catch (error) {
      console.debug('Could not copy release digest', error);
      setStatus('Could not copy SHA-256 digest.');
    }
  }

  function createAssetRow(asset) {
    const row = document.createElement('div');
    row.className = 'release-history-asset-row';

    const icon = document.createElement('i');
    icon.className = `${asset.iconClass} release-history-asset-logo`;
    icon.setAttribute('aria-hidden', 'true');
    const details = document.createElement('div');
    details.className = 'release-history-asset-details';
    const os = document.createElement('span');
    os.className = 'release-history-asset-os';
    os.textContent = asset.osLabel;
    const arch = document.createElement('span');
    arch.className = 'release-history-asset-arch';
    arch.textContent = asset.archLabel;
    const format = document.createElement('span');
    format.className = 'release-history-asset-format';
    format.textContent = asset.formatLabel;
    details.append(os, arch, format);
    const size = document.createElement('small');
    size.className = `release-history-asset-size${asset.size ? '' : ' is-unavailable'}`;
    size.textContent = asset.size || 'Size unavailable';
    details.append(size);
    const digest = document.createElement('button');
    digest.type = 'button';
    digest.className = `release-history-asset-digest${asset.digest ? '' : ' is-unavailable'}`;
    digest.disabled = !asset.digest;
    digest.setAttribute('aria-label', asset.digest
      ? `Copy SHA-256 digest ${asset.digest}`
      : 'SHA-256 digest unavailable');
    digest.title = asset.digest ? `Copy SHA-256 digest ${asset.digest}` : 'SHA-256 digest unavailable';
    const digestLabel = document.createElement('span');
    digestLabel.textContent = 'SHA-256';
    const digestValue = document.createElement('code');
    digestValue.textContent = asset.digest || 'unavailable';
    digest.append(digestLabel, digestValue);
    if (asset.digest) digest.addEventListener('click', () => { void copyDigestToClipboard(asset.digest); });

    const download = document.createElement('i');
    download.className = 'fa-solid fa-arrow-down-to-line';
    download.setAttribute('aria-hidden', 'true');
    const downloadButton = document.createElement('a');
    downloadButton.className = 'release-history-download-button';
    downloadButton.href = asset.url;
    downloadButton.target = '_blank';
    downloadButton.rel = 'noopener noreferrer';
    downloadButton.setAttribute('aria-label', `Download ${asset.label}${sizeDescription(asset.size)}`);
    downloadButton.append(download);
    const downloadLabel = document.createElement('span');
    downloadLabel.textContent = 'Download';
    downloadButton.append(downloadLabel);

    row.append(icon, details, digest, downloadButton);
    return row;
  }

  function sizeDescription(size) {
    return size ? ` (${size})` : '';
  }

  function createReleaseCard(release) {
    const channel = channelForTag(release.tag_name);
    const card = document.createElement('article');
    card.className = 'release-history-card';

    const header = document.createElement('div');
    header.className = 'release-history-card-header';
    const titleRow = document.createElement('div');
    titleRow.className = 'release-history-title-row';
    const title = document.createElement('h3');
    title.textContent = release.tag_name;
    const badge = document.createElement('span');
    badge.className = `release-channel-tag ${channel}`;
    badge.textContent = channel;
    titleRow.append(title, badge);

    const meta = document.createElement('div');
    meta.className = 'release-history-meta';
    const date = document.createElement('time');
    date.textContent = formatReleaseDate(release.published_at);
    if (release.published_at) date.dateTime = release.published_at;
    meta.append(date);
    if (release.html_url) {
      const notes = document.createElement('a');
      notes.className = 'release-history-notes-link';
      notes.href = release.html_url;
      notes.target = '_blank';
      notes.rel = 'noopener noreferrer';
      notes.textContent = 'Release notes';
      meta.append(notes);
    }
    header.append(titleRow, meta);

    const assets = document.createElement('ul');
    assets.className = 'release-history-assets';
    filteredAssets(release).forEach(asset => {
      const item = document.createElement('li');
      item.className = 'release-history-asset-item';
      item.append(createAssetRow(asset));
      assets.append(item);
    });
    card.append(header, assets);
    return card;
  }

  function render() {
    const list = byId('release-history-list');
    if (!list) return;

    const releases = filteredReleases();
    const start = (state.page - 1) * PAGE_SIZE;
    const visible = releases.slice(start, start + PAGE_SIZE);
    list.replaceChildren(...visible.map(createReleaseCard));

    const previous = byId('release-history-previous');
    const next = byId('release-history-next');
    const pageLabel = byId('release-history-page-label');
    const retry = byId('release-history-retry');
    const hasLoadedNextPage = releases.length > start + PAGE_SIZE;
    if (previous) previous.disabled = state.loading || state.page <= 1;
    if (next) {
      next.disabled = state.loading || (!hasLoadedNextPage && !state.hasMore);
      next.textContent = hasLoadedNextPage ? 'Next' : state.hasMore ? 'Load older' : 'Next';
    }
    if (pageLabel) pageLabel.textContent = `Page ${state.page}`;
    if (retry) retry.hidden = !state.error;

    if (state.loading) {
      setStatus('Loading release history…');
    } else if (state.error) {
      setStatus(visible.length
        ? 'Could not load more releases. Existing results are still available.'
        : 'Could not load release history. Check your connection and retry.');
    } else if (!visible.length) {
      setStatus(state.hasMore
        ? 'No releases match these filters in the loaded results. Choose “Load older” to search further back.'
        : 'No releases match these filters.');
    } else {
      const end = Math.min(start + visible.length, releases.length);
      const suffix = state.hasMore ? ' · More older releases are available.' : '';
      setStatus(`Showing ${start + 1}–${end} of ${releases.length} matching releases${suffix}`);
    }
  }

  function readCache() {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS && Array.isArray(cached.releases)) {
        state.releases = cached.releases.map(sanitizeRelease).filter(Boolean);
        state.apiPage = Math.max(0, Number(cached.apiPage) || 0);
        state.hasMore = Boolean(cached.hasMore);
        state.loaded = true;
        return true;
      }
    } catch {
      // Try the shared download-page cache below if the archive cache is unavailable.
    }

    try {
      const cached = JSON.parse(localStorage.getItem(SHARED_RELEASES_CACHE_KEY) || 'null');
      if (!cached || Date.now() - cached.timestamp >= CACHE_TTL_MS || !Array.isArray(cached.data)) return false;
      state.releases = cached.data.map(sanitizeRelease).filter(Boolean);
      state.apiPage = 1;
      state.hasMore = cached.data.length >= API_PAGE_SIZE;
      state.loaded = true;
      return true;
    } catch {
      return false;
    }
  }

  function writeCache() {
    try {
      const releases = state.releases.slice(0, MAX_CACHED_RELEASES);
      const apiPage = Math.min(state.apiPage, Math.ceil(MAX_CACHED_RELEASES / API_PAGE_SIZE));
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        apiPage,
        hasMore: state.hasMore || state.apiPage > apiPage,
        releases,
      }));
    } catch (error) {
      console.debug('Could not cache release history', error);
    }
  }

  function apiUrl(page) {
    const url = new URL(RELEASES_LIST_API_URL);
    url.searchParams.set('per_page', String(API_PAGE_SIZE));
    url.searchParams.set('page', String(page));
    return url.toString();
  }

  async function fetchNextApiPage() {
    if (state.loading || !state.hasMore) return false;
    state.loading = true;
    state.error = false;
    render();

    try {
      const requestFn = stage0?.restApi?.fetch || stage0?.fetch || fetch;
      const response = await requestFn(apiUrl(state.apiPage + 1), {
        timeout: 10000,
        headers: { Accept: 'application/vnd.github.v3+json, application/json' },
      });
      if (!response.ok) throw new Error(`GitHub Releases API returned ${response.status}`);
      const body = await response.json();
      if (!Array.isArray(body)) throw new Error('GitHub Releases API returned an invalid response');

      const knownTags = new Set(state.releases.map(release => release.tag_name));
      body.map(sanitizeRelease).filter(Boolean).forEach(release => {
        if (!knownTags.has(release.tag_name)) state.releases.push(release);
      });
      state.apiPage += 1;
      const linkHeader = response.headers?.get('link') || response.headers?.get('Link') || '';
      state.hasMore = linkHeader
        ? /rel="next"/.test(linkHeader)
        : body.length >= API_PAGE_SIZE;
      state.loaded = true;
      writeCache();
      return true;
    } catch (error) {
      console.debug('Could not fetch release history', error);
      state.error = true;
      return false;
    } finally {
      state.loading = false;
      render();
    }
  }

  async function loadInitial() {
    if (state.loaded) {
      render();
      return;
    }
    if (readCache()) {
      render();
      return;
    }
    await fetchNextApiPage();
  }

  async function nextPage() {
    const releases = filteredReleases();
    const pageEnd = state.page * PAGE_SIZE;
    if (releases.length > pageEnd) {
      state.page += 1;
      render();
      return;
    }
    if (state.hasMore) await fetchNextApiPage();
  }

  function bindControls() {
    document.querySelectorAll('[data-history-os]').forEach(button => {
      button.addEventListener('click', () => {
        state.os = button.getAttribute('data-history-os');
        state.page = 1;
        updateFilterButtons('data-history-os', state.os);
        render();
      });
    });
    document.querySelectorAll('[data-history-arch]').forEach(button => {
      button.addEventListener('click', () => {
        state.arch = button.getAttribute('data-history-arch');
        state.page = 1;
        updateFilterButtons('data-history-arch', state.arch);
        render();
      });
    });

    const previous = byId('release-history-previous');
    if (previous) previous.addEventListener('click', () => {
      if (state.page > 1) {
        state.page -= 1;
        render();
      }
    });
    const next = byId('release-history-next');
    if (next) next.addEventListener('click', () => { void nextPage(); });
    const retry = byId('release-history-retry');
    if (retry) retry.addEventListener('click', () => {
      if (!state.loaded) void loadInitial();
      else void fetchNextApiPage();
    });

  }

  function init() {
    if (!byId('release-history-list')) return;
    bindControls();
    void loadInitial();
  }

  if (stage0 && typeof stage0.__defineModule === 'function') {
    stage0.__defineModule('releaseHistory', { init });
  } else {
    window.Stage0 = window.Stage0 || {};
    window.Stage0.releaseHistory = { init };
  }
})();
