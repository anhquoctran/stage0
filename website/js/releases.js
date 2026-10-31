// Stage0 Dynamic Release & OS Detection Manager
(function () {
  'use strict';

  const s0 = window.stage0 || window.Stage0;

  // Retrieve core constants & active asset registry directly from Stage0
  const GITHUB_REPO = s0?.getConstant('GITHUB_REPO', 'anhquoctran/stage0') || 'anhquoctran/stage0';
  const RELEASES_PAGE_URL = s0?.getConstant('RELEASES_PAGE_URL', `https://github.com/${GITHUB_REPO}/releases/latest`) || `https://github.com/${GITHUB_REPO}/releases/latest`;
  const RELEASES_ARCHIVE_URL = `https://github.com/${GITHUB_REPO}/releases`;
  const RELEASES_API_URL = s0?.getConstant('RELEASES_API_URL', `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`) || `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
  const RELEASES_LIST_API_URL = s0?.getConstant('RELEASES_LIST_API_URL', `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=100`) || `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=100`;
  const CACHE_KEY = s0?.getConstant('CACHE_KEY', 'stage0_latest_release_cache') || 'stage0_latest_release_cache';
  const RELEASES_LIST_CACHE_KEY = s0?.getConstant('RELEASES_LIST_CACHE_KEY', 'stage0_release_list_cache') || 'stage0_release_list_cache';
  const CACHE_TTL_MS = s0?.getConstant('CACHE_TTL_MS', 10 * 60 * 1000) || (10 * 60 * 1000);
  const latestAssets = s0?.latestAssets || {
    windowsExe: RELEASES_PAGE_URL,
    macArm: RELEASES_PAGE_URL,
    macIntel: RELEASES_PAGE_URL,
    linuxAppImage: RELEASES_PAGE_URL,
    linuxDeb: RELEASES_PAGE_URL,
    linuxRpm: RELEASES_PAGE_URL,
    tarArchive: RELEASES_PAGE_URL
  };

  let currentDetectedOS = 'unknown';
  let currentDetectedMacArchitecture = null;
  let currentDetectedArchitecture = null;
  let currentDetectedLinuxDownloadKey = null;
  let currentReleaseChannel = 'stable';
  let releaseCatalog = [];
  let releaseCatalogLoaded = false;
  let selectedRelease = null;
  let currentReleaseDetailsUrl = RELEASES_PAGE_URL;

  function releaseChannelFromTag(tag) {
    if (/^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(String(tag || ''))) return 'stable';
    const match = String(tag || '').match(/^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)-(nightly|beta)\.[1-9]\d{7}\.(?:0|[1-9]\d*)$/);
    return match?.[1] || null;
  }

  function releaseStatusElement() {
    return document.getElementById('release-channel-status');
  }

  function updateReleaseLink(url) {
    const link = document.getElementById('selected-release-link');
    if (link) link.href = url || RELEASES_PAGE_URL;
    document.querySelectorAll('[data-release-page-link]').forEach(item => {
      item.href = url || RELEASES_PAGE_URL;
    });
  }

  function updateChannelButtons() {
    document.querySelectorAll('[data-release-channel]').forEach(button => {
      const active = button.getAttribute('data-release-channel') === currentReleaseChannel;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function releasesForChannel(channel) {
    return releaseCatalog.filter(release => !release.draft && releaseChannelFromTag(release.tag_name) === channel);
  }

  function resetReleaseAssets(fallbackUrl) {
    Object.keys(latestAssets).forEach(key => {
      latestAssets[key] = fallbackUrl || RELEASES_PAGE_URL;
    });
  }

  function updateVersionOptions(releases) {
    const picker = document.getElementById('release-version-picker');
    const trigger = document.getElementById('release-version-trigger');
    const label = document.getElementById('release-version-label');
    const optionsList = document.getElementById('release-version-options');
    if (!picker || !trigger || !label || !optionsList) return;

    picker.open = false;
    picker.classList.toggle('is-disabled', releases.length === 0);
    trigger.setAttribute('aria-disabled', releases.length ? 'false' : 'true');
    trigger.setAttribute('aria-expanded', 'false');
    optionsList.replaceChildren(...releases.map(release => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'release-version-option';
      option.setAttribute('role', 'option');
      option.setAttribute('data-release-tag', release.tag_name);
      option.setAttribute('aria-selected', 'false');
      option.textContent = release.tag_name;
      option.addEventListener('click', () => applyReleaseData(release));
      return option;
    }));

    label.textContent = releases[0]?.tag_name || 'No releases available';
  }

  function showEmptyReleaseChannel(channel) {
    selectedRelease = null;
    releaseCatalogLoaded = true;
    currentReleaseDetailsUrl = RELEASES_ARCHIVE_URL;
    resetReleaseAssets(currentReleaseDetailsUrl);
    updateDownloadAssetSizes({});
    updateReleaseLink(currentReleaseDetailsUrl);
    document.querySelectorAll('.version-badge, [data-latest-version]').forEach(el => {
      el.textContent = '—';
    });
    document.querySelectorAll('[data-download-key]').forEach(el => {
      el.href = currentReleaseDetailsUrl;
    });

    updateVersionOptions([]);

    const status = releaseStatusElement();
    if (status) status.textContent = `No ${channel} releases are available yet.`;
    applyHeroOS(currentDetectedOS, currentDetectedMacArchitecture, currentDetectedLinuxDownloadKey);
  }

  function selectReleaseChannel(channel) {
    if (!['stable', 'beta', 'nightly'].includes(channel)) return;
    currentReleaseChannel = channel;
    updateChannelButtons();

    const releases = releasesForChannel(channel);
    updateVersionOptions(releases);

    if (!releases.length) {
      showEmptyReleaseChannel(channel);
      return;
    }

    const latest = releases[0];
    applyReleaseData(latest);
  }

  function setReleaseCatalog(releases) {
    releaseCatalogLoaded = true;
    releaseCatalog = Array.isArray(releases) ? releases.filter(release => release?.tag_name && !release.draft) : [];
    selectReleaseChannel(currentReleaseChannel);
  }

  function bindReleaseBrowserControls() {
    document.querySelectorAll('[data-release-channel]').forEach(button => {
      button.addEventListener('click', () => selectReleaseChannel(button.getAttribute('data-release-channel')));
    });
    const picker = document.getElementById('release-version-picker');
    const trigger = document.getElementById('release-version-trigger');
    if (picker && trigger) {
      picker.addEventListener('toggle', () => trigger.setAttribute('aria-expanded', picker.open ? 'true' : 'false'));
      picker.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
          picker.open = false;
          trigger.focus();
        }
      });
    }
    updateChannelButtons();
  }

  // 1. OS Auto-Detection for Hero CTA
  function detectUserOS() {
    const ua = (navigator.userAgent || '').toLowerCase();
    const platform = (navigator.platform || '').toLowerCase();
    const clientPlatform = (navigator.userAgentData?.platform || '').toLowerCase();
    const isIPadDesktopMode = platform.includes('mac')
      && Number(navigator.maxTouchPoints) > 1
      && ua.includes('macintosh');

    // iPadOS may expose MacIntel in desktop mode. Do not recommend a macOS installer.
    if (/iphone|ipad|ipod/.test(ua) || clientPlatform.includes('ios') || isIPadDesktopMode) {
      return 'ios';
    }
    if (ua.includes('android') || clientPlatform.includes('android')) return 'android';

    // Prefer explicit UA OS tokens. Responsive-mode UA overrides may change the
    // requested device while navigator.platform still describes the host machine.
    if (ua.includes('windows') || ua.includes('win32') || ua.includes('win64') || ua.includes('wow64')) return 'windows';
    if (ua.includes('macintosh') || ua.includes('mac os x') || ua.includes('darwin')) return 'macos';
    if (ua.includes('linux') || ua.includes('x11') || ua.includes('ubuntu') || ua.includes('debian') || ua.includes('fedora')) return 'linux';

    // navigator.platform and Client Hints are fallbacks when the UA is reduced.
    if (platform.includes('win')) return 'windows';
    if (platform.includes('mac')) return 'macos';
    if (platform.includes('linux') || platform.includes('x11')) return 'linux';

    // Client hints are useful when the UA/platform strings are reduced or absent.
    if (navigator.userAgentData && navigator.userAgentData.platform) {
      const clientPlatform = navigator.userAgentData.platform.toLowerCase();
      if (clientPlatform.includes('win')) return 'windows';
      if (clientPlatform.includes('mac')) return 'macos';
      if (clientPlatform.includes('linux')) return 'linux';
    }

    return 'unknown';
  }

  function normalizeMacArchitecture(architecture, bitness) {
    const value = String(architecture || '').toLowerCase();
    const bits = String(bitness || '').toLowerCase();
    if (/^(arm|arm64|aarch64)$/.test(value) && bits !== '32') return 'arm64';
    if (/^(x86|x86_64|x64|amd64)$/.test(value) && bits !== '32') return 'x86_64';
    return null;
  }

  function normalizeArchitecture(architecture, bitness) {
    const value = String(architecture || '').toLowerCase();
    const bits = String(bitness || '').toLowerCase();
    if (/^(arm|arm64|aarch64)$/.test(value) && bits !== '32') return 'arm64';
    if (/^(x86_64|x64|amd64)$/.test(value) && bits !== '32') return 'x64';
    if (value === 'x86' && bits === '64') return 'x64';
    return null;
  }

  async function detectArchitecture(osName) {
    if (osName === 'macos') {
      const macArchitecture = await detectMacArchitecture();
      return macArchitecture === 'arm64' ? 'arm64' : macArchitecture === 'x86_64' ? 'x64' : null;
    }

    const userAgentData = navigator.userAgentData;
    if (userAgentData && typeof userAgentData.getHighEntropyValues === 'function') {
      try {
        const hints = await userAgentData.getHighEntropyValues(['architecture', 'bitness']);
        const architecture = normalizeArchitecture(hints.architecture, hints.bitness);
        if (architecture) return architecture;
      } catch (error) {
        console.debug('Could not read browser architecture hints', error);
      }
    }

    const ua = (navigator.userAgent || '').toLowerCase();
    const platform = (navigator.platform || '').toLowerCase();
    if (/\b(aarch64|arm64|armv8|arm64-v8a)\b/.test(`${ua} ${platform}`)) return 'arm64';
    if (/\b(x86_64|x86-64|amd64|win64|x64)\b/.test(`${ua} ${platform}`)) return 'x64';

    // x64 is the supported default for browsers that do not expose architecture hints.
    return osName === 'windows' || osName === 'linux' ? 'x64' : null;
  }

  function detectMacArchitectureFromRenderer() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl');
      if (!gl) return null;

      const rendererInfo = gl.getExtension('WEBGL_debug_renderer_info');
      const renderer = rendererInfo
        ? gl.getParameter(rendererInfo.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER);
      const value = String(renderer || '').toLowerCase();

      // Safari may expose the Apple GPU/M-series renderer while its UA says "Intel Mac".
      // Keep this check local; the renderer is only used to select the matching installer.
      if (/\bapple\s+(?:m[1-9]\d*(?:\s+(?:pro|max|ultra))?|gpu)\b/.test(value)) return 'arm64';
      if (/\b(intel|amd|radeon)\b/.test(value)) return 'x86_64';
    } catch (error) {
      console.debug('Could not read local graphics renderer', error);
    }
    return null;
  }

  function detectLinuxDownloadKey() {
    const ua = (navigator.userAgent || '').toLowerCase();
    if (/\b(ubuntu|debian|linux mint|linuxmint|pop!?_?os|pop os|elementary os)\b/.test(ua)) {
      return 'linuxDeb';
    }
    if (/\b(fedora|rhel|red hat|centos|rocky|alma|opensuse|open suse|suse)\b/.test(ua)) {
      return 'linuxRpm';
    }
    return 'linuxAppImage';
  }

  function assetUrlForRelease(release, predicate) {
    const asset = (release?.assets || []).find(item => item?.name && !item.name.endsWith('.sig') && predicate(item.name));
    return asset?.browser_download_url || null;
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

  function stableAssetSize(url) {
    if (!url) return '';
    for (const release of releasesForChannel('stable')) {
      const asset = (release.assets || []).find(item => item?.browser_download_url === url);
      const size = formatAssetSize(asset?.size);
      if (size) return size;
    }
    return '';
  }

  function labelWithAssetSize(label, url) {
    const size = stableAssetSize(url);
    return `(${label}${size ? ` · ${size}` : ''})`;
  }

  function updateDownloadAssetSizes(assetsByKey) {
    document.querySelectorAll('[data-asset-size-for]').forEach(element => {
      const key = element.getAttribute('data-asset-size-for');
      const size = formatAssetSize(assetsByKey[key]?.size);
      element.textContent = size ? `· ${size}` : '';
      element.hidden = !size;
    });
  }

  function stableAssetUrl(predicate) {
    const stableReleases = releasesForChannel('stable');
    for (const release of stableReleases) {
      const url = assetUrlForRelease(release, predicate);
      if (url) return url;
    }

    // Until the catalog arrives, callers keep the initialized latest-stable page URL.
    // Once loaded, only a matching artifact from a stable release is returned here.
    return null;
  }

  function stableWindowsUrl(architecture) {
    if (architecture === 'arm64') {
      const armUrl = stableAssetUrl(name => name.endsWith('.exe') && /(aarch64|arm64)/i.test(name));
      if (armUrl) return armUrl;
      if (!releaseCatalogLoaded) return latestAssets.windowsArm64 || null;
    } else if (architecture !== 'x64') {
      return null;
    }
    return stableAssetUrl(name => name.endsWith('.exe') && /(x86_64|x64|amd64)/i.test(name) && !/(aarch64|arm64)/i.test(name))
      || (!releaseCatalogLoaded ? latestAssets.windowsExe : null);
  }

  function stableMacUrl(architecture) {
    if (architecture === 'arm64') {
      return stableAssetUrl(name => name.endsWith('.dmg') && /(aarch64|arm64)/i.test(name))
        || (!releaseCatalogLoaded ? latestAssets.macArm : null);
    }
    if (architecture === 'x64') {
      return stableAssetUrl(name => name.endsWith('.dmg') && /(x86_64|x64|amd64)/i.test(name) && /apple-darwin|darwin/i.test(name))
        || (!releaseCatalogLoaded ? latestAssets.macIntel : null);
    }
    return null;
  }

  function stableLinuxUrl(architecture, preferredKey) {
    if (architecture !== 'arm64' && architecture !== 'x64') return null;
    const target = architecture === 'arm64' ? 'aarch64-unknown-linux' : 'x86_64-unknown-linux';
    const packageExtensions = architecture === 'arm64'
      ? preferredKey === 'linuxRpm' ? ['.rpm', '.deb'] : ['.deb', '.rpm']
      : preferredKey === 'linuxDeb'
        ? ['.deb', '.AppImage', '.rpm']
        : preferredKey === 'linuxRpm'
          ? ['.rpm', '.AppImage', '.deb']
          : ['.AppImage', '.deb', '.rpm'];

    for (const extension of packageExtensions) {
      const url = stableAssetUrl(name => name.includes(target) && name.endsWith(extension));
      if (url) return { url, extension };
    }
    if (!releaseCatalogLoaded && architecture === 'x64') {
      const legacyKey = preferredKey && latestAssets[preferredKey] !== RELEASES_PAGE_URL
        ? preferredKey
        : 'linuxAppImage';
      const legacyExtension = { linuxAppImage: '.AppImage', linuxDeb: '.deb', linuxRpm: '.rpm' }[legacyKey];
      if (legacyExtension && latestAssets[legacyKey]) return { url: latestAssets[legacyKey], extension: legacyExtension };
    }
    return null;
  }

  async function detectMacArchitecture() {
    const rendererArchitecture = detectMacArchitectureFromRenderer();
    if (rendererArchitecture) return rendererArchitecture;

    const userAgentData = navigator.userAgentData;
    if (userAgentData && typeof userAgentData.getHighEntropyValues === 'function') {
      try {
        const hints = await userAgentData.getHighEntropyValues(['architecture', 'bitness']);
        const architecture = normalizeMacArchitecture(hints.architecture, hints.bitness);
        if (architecture) return architecture;
      } catch (error) {
        console.debug('Could not read browser architecture hints', error);
      }
    }

    // Use only explicit architecture tokens. Safari's "Intel Mac" UA is also used on Apple silicon.
    const ua = (navigator.userAgent || '').toLowerCase();
    if (/\b(arm64|aarch64)\b/.test(ua)) return 'arm64';
    if (/\b(x86_64|x86-64)\b/.test(ua)) return 'x86_64';
    return null;
  }

  function clearRecommendedDownload() {
    document.querySelectorAll('.download-recommended').forEach(button => {
      button.classList.remove('download-recommended');
    });
  }

  function recommendDownload(assetKey) {
    const button = document.querySelector(`[data-download-key="${assetKey}"]`);
    if (button) button.classList.add('download-recommended');
  }

  function setCardBadge(card, label) {
    const badgeLabel = card?.querySelector('.card-detected-badge span');
    if (badgeLabel) badgeLabel.textContent = label;
  }

  function applyHeroOS(
    osName,
    macArchitecture = currentDetectedMacArchitecture,
    linuxDownloadKey = currentDetectedLinuxDownloadKey
  ) {
    currentDetectedOS = osName;
    currentDetectedMacArchitecture = osName === 'macos'
      ? normalizeMacArchitecture(macArchitecture)
      : null;
    currentDetectedLinuxDownloadKey = osName === 'linux'
      ? linuxDownloadKey || 'linuxAppImage'
      : null;
    const heroDownloadBtn = document.getElementById('hero-download-btn');
    const heroBtnText = document.getElementById('hero-btn-text');
    const heroPlatformLabel = document.getElementById('hero-platform-label');
    const heroOsIcon = document.getElementById('hero-os-icon');
    const windowsCard = document.getElementById('card-windows');
    const macCard = document.getElementById('card-macos');
    const linuxCard = document.getElementById('card-linux');
    // Reset highlight cards
    [windowsCard, macCard, linuxCard].forEach(c => {
      if (!c) return;
      c.classList.remove('highlight');
      setCardBadge(c, 'Your OS');
    });
    clearRecommendedDownload();

    if (osName === 'macos') {
      if (macCard) macCard.classList.add('highlight');
      const isAppleSilicon = currentDetectedMacArchitecture === 'arm64';
      const isIntel = currentDetectedMacArchitecture === 'x86_64';
      const stableUrl = stableMacUrl(currentDetectedArchitecture);
      if (isAppleSilicon && stableUrl) recommendDownload('macArm');
      if (isIntel && stableUrl) recommendDownload('macIntel');
      if (!isAppleSilicon && !isIntel) setCardBadge(macCard, 'Choose your chip');
      if (heroOsIcon) heroOsIcon.className = 'fa-brands fa-apple';
      if (heroBtnText) heroBtnText.textContent = stableUrl ? 'Download for macOS' : 'Browse releases';
      if (heroPlatformLabel) {
        heroPlatformLabel.textContent = stableUrl
          ? isAppleSilicon
            ? labelWithAssetSize('Apple Silicon .dmg', stableUrl)
            : isIntel
              ? labelWithAssetSize('Intel .dmg', stableUrl)
              : '(Choose Apple Silicon or Intel below)'
          : '(No matching stable build found)';
      }
      if (heroDownloadBtn) {
        heroDownloadBtn.href = stableUrl || RELEASES_PAGE_URL;
        heroDownloadBtn.setAttribute('data-umami-event', 'hero-download-macos');
        heroDownloadBtn.setAttribute('data-umami-event-os', 'macos');
      }
    } else if (osName === 'linux') {
      if (linuxCard) linuxCard.classList.add('highlight');
      const stableLinux = stableLinuxUrl(currentDetectedArchitecture, currentDetectedLinuxDownloadKey);
      const downloadKey = stableLinux?.extension === '.deb'
        ? 'linuxDeb'
        : stableLinux?.extension === '.rpm'
          ? 'linuxRpm'
          : stableLinux?.extension === '.AppImage'
            ? 'linuxAppImage'
            : null;
      if (downloadKey && currentDetectedArchitecture !== 'arm64') recommendDownload(downloadKey);
      else setCardBadge(linuxCard, currentDetectedArchitecture === 'arm64' ? 'ARM64 quick download' : 'Choose package');
      if (heroOsIcon) heroOsIcon.className = 'fa-brands fa-linux';
      if (heroBtnText) heroBtnText.textContent = stableLinux ? 'Download for Linux' : 'View Linux downloads';
      if (heroPlatformLabel) {
        const architectureLabel = currentDetectedArchitecture === 'arm64' ? 'ARM64' : 'x64';
        heroPlatformLabel.textContent = stableLinux
          ? labelWithAssetSize(`${architectureLabel} ${stableLinux.extension}`, stableLinux.url)
          : '(No matching stable build found)';
      }
      if (heroDownloadBtn) {
        heroDownloadBtn.href = stableLinux?.url || RELEASES_PAGE_URL;
        heroDownloadBtn.setAttribute('data-umami-event', 'hero-download-linux');
        heroDownloadBtn.setAttribute('data-umami-event-os', 'linux');
      }
    } else if (osName === 'windows') {
      if (windowsCard) windowsCard.classList.add('highlight');
      const stableUrl = stableWindowsUrl(currentDetectedArchitecture);
      if (stableUrl && currentDetectedArchitecture !== 'arm64') recommendDownload('windowsExe');
      if (heroOsIcon) heroOsIcon.className = 'fa-brands fa-windows';
      if (heroBtnText) heroBtnText.textContent = stableUrl ? 'Download for Windows' : 'Browse releases';
      if (heroPlatformLabel) heroPlatformLabel.textContent = stableUrl
        ? labelWithAssetSize(currentDetectedArchitecture === 'arm64' ? 'ARM64 .exe' : '64-bit .exe', stableUrl)
        : '(No matching stable build found)';
      if (heroDownloadBtn) {
        heroDownloadBtn.href = stableUrl || RELEASES_PAGE_URL;
        heroDownloadBtn.setAttribute('data-umami-event', 'hero-download-windows');
        heroDownloadBtn.setAttribute('data-umami-event-os', 'windows');
      }
    } else {
      if (heroOsIcon) heroOsIcon.className = 'fa-brands fa-windows';
      if (heroBtnText) heroBtnText.textContent = 'Download for Windows';
      const stableUrl = stableWindowsUrl('x64');
      if (heroPlatformLabel) heroPlatformLabel.textContent = labelWithAssetSize('64-bit .exe', stableUrl);
      if (heroDownloadBtn) {
        heroDownloadBtn.href = stableUrl || RELEASES_PAGE_URL;
        heroDownloadBtn.setAttribute('data-umami-event', 'hero-download-windows');
        heroDownloadBtn.setAttribute('data-umami-event-os', 'windows');
      }
    }
  }

  async function initOsDetection() {
    const detected = detectUserOS();
    currentDetectedMacArchitecture = null;
    currentDetectedArchitecture = null;
    currentDetectedLinuxDownloadKey = detected === 'linux' ? detectLinuxDownloadKey() : null;
    applyHeroOS(detected, null, currentDetectedLinuxDownloadKey);
    if (detected !== 'macos' && detected !== 'windows' && detected !== 'linux') return;

    const architecture = await detectArchitecture(detected);
    if (currentDetectedOS !== detected) return;
    currentDetectedArchitecture = architecture;
    currentDetectedMacArchitecture = architecture === 'arm64' ? 'arm64' : architecture === 'x64' ? 'x86_64' : null;
    applyHeroOS(detected, currentDetectedMacArchitecture, currentDetectedLinuxDownloadKey);
  }

  // 2. Dynamic Version & Asset Resolver from GitHub API
  function initCachedRelease() {
    try {
      const raw = localStorage.getItem(RELEASES_LIST_CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        if (Array.isArray(cached?.data)) {
          setReleaseCatalog(cached.data);
          return;
        }
      }

      // Migrate the old stable-only cache while the channel catalog is fetched.
      const oldCache = localStorage.getItem(CACHE_KEY);
      const cachedRelease = oldCache ? JSON.parse(oldCache)?.data : null;
      if (cachedRelease?.tag_name) setReleaseCatalog([cachedRelease]);
    } catch (err) {
      console.debug('Failed to read cached releases', err);
    }
  }

  function applyReleaseData(release) {
    if (!release) return;
    selectedRelease = release;

    const versionTag = release.tag_name || release.name || '';
    if (versionTag) {
      document.querySelectorAll('.version-badge, [data-latest-version]').forEach(el => {
        el.textContent = versionTag;
      });
      const versionLabel = document.getElementById('release-version-label');
      if (versionLabel) versionLabel.textContent = versionTag;
      document.querySelectorAll('.release-version-option').forEach(option => {
        option.setAttribute('aria-selected', option.getAttribute('data-release-tag') === versionTag ? 'true' : 'false');
      });
      const picker = document.getElementById('release-version-picker');
      const trigger = document.getElementById('release-version-trigger');
      if (picker) picker.open = false;
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    }

    currentReleaseDetailsUrl = release.html_url || `https://github.com/${GITHUB_REPO}/releases/tag/${encodeURIComponent(versionTag)}`;
    updateReleaseLink(currentReleaseDetailsUrl);
    resetReleaseAssets(currentReleaseDetailsUrl);

    const findAsset = (predicate) => {
      return (release.assets || []).find(asset => asset?.name && !asset.name.endsWith('.sig') && predicate(asset)) || null;
    };

    const releaseAssets = {
      windowsExe: findAsset(a => a.name.endsWith('.exe') && !/(aarch64|arm64)/i.test(a.name)),
      macArm: findAsset(a => /(aarch64|arm64)/i.test(a.name) && a.name.endsWith('.dmg')),
      macIntel: findAsset(a => /(x86_64|x64)/i.test(a.name) && a.name.includes('darwin') && a.name.endsWith('.dmg')),
      linuxAppImage: findAsset(a => a.name.includes('x86_64-unknown-linux') && a.name.endsWith('.AppImage')),
      linuxDeb: findAsset(a => a.name.includes('x86_64-unknown-linux') && a.name.endsWith('.deb')),
      linuxRpm: findAsset(a => a.name.includes('x86_64-unknown-linux') && a.name.endsWith('.rpm')),
      tarArchive: findAsset(a => a.name.includes('unknown-linux') && a.name.endsWith('.tar.gz')),
    };
    Object.entries(releaseAssets).forEach(([key, asset]) => {
      latestAssets[key] = asset?.browser_download_url || currentReleaseDetailsUrl;
    });
    updateDownloadAssetSizes(releaseAssets);

    document.querySelectorAll('[data-download-key]').forEach(el => {
      const key = el.getAttribute('data-download-key');
      el.href = latestAssets[key] || currentReleaseDetailsUrl;
    });

    const status = releaseStatusElement();
    if (status) status.textContent = `${versionTag} · ${currentReleaseChannel[0].toUpperCase()}${currentReleaseChannel.slice(1)} release`;

    applyHeroOS(
      currentDetectedOS,
      currentDetectedMacArchitecture,
      currentDetectedLinuxDownloadKey
    );

    // Update credit year from release timestamp if available
    if (release.published_at || release.created_at) {
      const pubYear = extractYearFromDateString(release.published_at || release.created_at);
      if (pubYear) updateCreditYear(pubYear);
    }
  }

  async function fetchLatestReleaseAssets() {
    try {
      const raw = localStorage.getItem(RELEASES_LIST_CACHE_KEY);
      if (raw) {
        try {
          const cached = JSON.parse(raw);
          if (cached && cached.timestamp && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
            if (Array.isArray(cached.data)) setReleaseCatalog(cached.data);
            return;
          }
        } catch (e) {}
      }

      const requestFn = s0?.restApi?.fetch || s0?.fetch || fetch;
      const res = await requestFn(RELEASES_LIST_API_URL, {
        timeout: 8000,
        headers: { Accept: 'application/vnd.github.v3+json, application/json' }
      });
      if (!res.ok) {
        console.warn(`GitHub Releases API responded with status ${res.status}`);
        return;
      }

      const apiDate = res.headers.get('date');
      if (apiDate) {
        const serverYear = extractYearFromDateString(apiDate);
        if (serverYear) updateCreditYear(serverYear);
      }

      const releases = await res.json();
      if (Array.isArray(releases)) {
        if (!releases.some(release => releaseChannelFromTag(release?.tag_name) === 'stable')) {
          try {
            const stableResponse = await requestFn(RELEASES_API_URL, {
              timeout: 8000,
              headers: { Accept: 'application/vnd.github.v3+json, application/json' }
            });
            if (stableResponse.ok) {
              const latestStable = await stableResponse.json();
              if (releaseChannelFromTag(latestStable?.tag_name) === 'stable') releases.unshift(latestStable);
            }
          } catch (stableError) {
            console.debug('Could not load latest stable release', stableError);
          }
        }

        try {
          localStorage.setItem(RELEASES_LIST_CACHE_KEY, JSON.stringify({
            data: releases,
            timestamp: Date.now()
          }));
        } catch (cacheErr) {
          console.debug('Could not write releases to localStorage', cacheErr);
        }

        setReleaseCatalog(releases);
      }
    } catch (err) {
      console.debug('Direct GitHub asset lookup deferred', err);
    }
  }

  // 3. Dynamic Credit Year
  function updateCreditYear(year) {
    const num = parseInt(year, 10);
    if (!isNaN(num) && num >= 2024 && num <= 2099) {
      const el = document.getElementById('credit-year');
      if (el && el.textContent !== String(num)) {
        el.textContent = String(num);
        return true;
      }
    }
    return false;
  }

  function extractYearFromDateString(str) {
    if (!str) return null;
    const match = String(str).match(/\b(20\d{2})\b/);
    if (match) {
      const y = parseInt(match[1], 10);
      if (y >= 2024 && y <= 2099) return y;
    }
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getUTCFullYear();
      if (y >= 2024 && y <= 2099) return y;
    }
    return null;
  }

  async function initDynamicCreditYear() {
    if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
      try {
        const headFn = s0?.restApi?.head || s0?.head || ((url, opts) => (s0?.fetch || fetch)(url, { ...opts, method: 'HEAD' }));
        const headRes = await headFn(window.location.href, { cache: 'no-store', timeout: 4000 });
        const serverDate = headRes?.headers?.get('date');
        if (serverDate) {
          const year = extractYearFromDateString(serverDate);
          if (year && updateCreditYear(year)) return;
        }
      } catch (e) {}
    }

    try {
      const raw = localStorage.getItem(RELEASES_LIST_CACHE_KEY) || localStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        const latestCachedRelease = Array.isArray(cached?.data) ? cached.data[0] : cached?.data;
        const pubDate = selectedRelease?.published_at || latestCachedRelease?.published_at || latestCachedRelease?.created_at;
        if (pubDate) {
          const year = extractYearFromDateString(pubDate);
          if (year && updateCreditYear(year)) return;
        }
      }
    } catch (e) {}

    const localYear = new Date().getFullYear();
    if (localYear >= 2026 && localYear <= 2099) {
      updateCreditYear(localYear);
    } else {
      updateCreditYear(2026);
    }
  }

  bindReleaseBrowserControls();

  // Register with Stage0 global registry
  if (s0 && typeof s0.__defineModule === 'function') {
    s0.__defineModule('releases', {
      releaseChannelFromTag,
      detectUserOS,
      applyHeroOS,
      initOsDetection,
      selectReleaseChannel,
      initCachedRelease,
      applyReleaseData,
      fetchLatestReleaseAssets,
      initDynamicCreditYear,
      latestAssets,
      get currentReleaseChannel() { return currentReleaseChannel; },
      get selectedRelease() { return selectedRelease; },
      get currentDetectedOS() { return currentDetectedOS; }
    });

    s0.__defineFunction('detectUserOS', detectUserOS);
    s0.__defineFunction('applyHeroOS', applyHeroOS);
    s0.__defineFunction('initOsDetection', initOsDetection);
    s0.__defineFunction('initCachedRelease', initCachedRelease);
    s0.__defineFunction('fetchLatestReleaseAssets', fetchLatestReleaseAssets);
    s0.__defineFunction('initDynamicCreditYear', initDynamicCreditYear);
  } else {
    window.Stage0 = window.Stage0 || {};
    window.Stage0.releases = {
      releaseChannelFromTag,
      detectUserOS,
      applyHeroOS,
      initOsDetection,
      selectReleaseChannel,
      initCachedRelease,
      applyReleaseData,
      fetchLatestReleaseAssets,
      initDynamicCreditYear,
      latestAssets,
      get currentReleaseChannel() { return currentReleaseChannel; },
      get selectedRelease() { return selectedRelease; },
      get currentDetectedOS() { return currentDetectedOS; }
    };
    window.detectUserOS = detectUserOS;
    window.applyHeroOS = applyHeroOS;
    window.initOsDetection = initOsDetection;
    window.initCachedRelease = initCachedRelease;
    window.fetchLatestReleaseAssets = fetchLatestReleaseAssets;
    window.initDynamicCreditYear = initDynamicCreditYear;
  }
})();

