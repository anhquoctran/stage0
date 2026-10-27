// Stage0 Dynamic Release & OS Detection Manager
(function () {
  'use strict';

  const s0 = window.stage0 || window.Stage0;

  // Retrieve core constants & active asset registry directly from Stage0
  const GITHUB_REPO = s0?.getConstant('GITHUB_REPO', 'anhquoctran/stage0') || 'anhquoctran/stage0';
  const RELEASES_PAGE_URL = s0?.getConstant('RELEASES_PAGE_URL', `https://github.com/${GITHUB_REPO}/releases/latest`) || `https://github.com/${GITHUB_REPO}/releases/latest`;
  const RELEASES_API_URL = s0?.getConstant('RELEASES_API_URL', `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`) || `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
  const CACHE_KEY = s0?.getConstant('CACHE_KEY', 'stage0_latest_release_cache') || 'stage0_latest_release_cache';
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

  let currentDetectedOS = 'windows';

  // 1. OS Auto-Detection for Hero CTA
  function detectUserOS() {
    // Check modern Client Hints (Chromium: Chrome, Edge, Brave, Opera)
    if (navigator.userAgentData && navigator.userAgentData.platform) {
      const p = navigator.userAgentData.platform.toLowerCase();
      if (p.includes('win')) return 'windows';
      if (p.includes('mac')) return 'macos';
      if (p.includes('linux')) return 'linux';
    }

    // Check navigator.platform
    const platform = (navigator.platform || '').toLowerCase();
    if (platform.includes('win')) return 'windows';
    if (platform.includes('mac') || platform.includes('iphone') || platform.includes('ipad')) return 'macos';
    if (platform.includes('linux') || platform.includes('x11')) return 'linux';

    // Check navigator.userAgent
    const ua = (navigator.userAgent || '').toLowerCase();
    if (ua.includes('windows') || ua.includes('win32') || ua.includes('win64') || ua.includes('wow64')) return 'windows';
    if (ua.includes('macintosh') || ua.includes('mac os x') || ua.includes('darwin')) return 'macos';
    if (ua.includes('linux') || ua.includes('x11') || ua.includes('ubuntu') || ua.includes('debian') || ua.includes('fedora')) return 'linux';

    return 'windows';
  }

  function applyHeroOS(osName) {
    currentDetectedOS = osName;
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
    });

    if (osName === 'macos') {
      if (macCard) macCard.classList.add('highlight');
      if (heroOsIcon) heroOsIcon.className = 'fa-brands fa-apple';
      if (heroBtnText) heroBtnText.textContent = 'Download for macOS';
      if (heroPlatformLabel) heroPlatformLabel.textContent = '(Apple Silicon / Intel .dmg)';
      if (heroDownloadBtn) {
        heroDownloadBtn.href = latestAssets.macArm;
        heroDownloadBtn.setAttribute('data-umami-event', 'hero-download-macos');
        heroDownloadBtn.setAttribute('data-umami-event-os', 'macos');
      }
    } else if (osName === 'linux') {
      if (linuxCard) linuxCard.classList.add('highlight');
      if (heroOsIcon) heroOsIcon.className = 'fa-brands fa-linux';
      if (heroBtnText) heroBtnText.textContent = 'Download for Linux';
      if (heroPlatformLabel) heroPlatformLabel.textContent = '(.AppImage, .deb, .rpm)';
      if (heroDownloadBtn) {
        heroDownloadBtn.href = latestAssets.linuxAppImage;
        heroDownloadBtn.setAttribute('data-umami-event', 'hero-download-linux');
        heroDownloadBtn.setAttribute('data-umami-event-os', 'linux');
      }
    } else {
      // Windows default
      if (windowsCard) windowsCard.classList.add('highlight');
      if (heroOsIcon) heroOsIcon.className = 'fa-brands fa-windows';
      if (heroBtnText) heroBtnText.textContent = 'Download for Windows';
      if (heroPlatformLabel) heroPlatformLabel.textContent = '(64-bit .exe)';
      if (heroDownloadBtn) {
        heroDownloadBtn.href = latestAssets.windowsExe;
        heroDownloadBtn.setAttribute('data-umami-event', 'hero-download-windows');
        heroDownloadBtn.setAttribute('data-umami-event-os', 'windows');
      }
    }
  }

  function initOsDetection() {
    const detected = detectUserOS();
    applyHeroOS(detected);
  }

  // 2. Dynamic Version & Asset Resolver from GitHub API
  function initCachedRelease() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return;
      const cached = JSON.parse(raw);
      if (cached && cached.data) {
        applyReleaseData(cached.data);
      }
    } catch (err) {
      console.debug('Failed to read cached release', err);
    }
  }

  function applyReleaseData(release) {
    if (!release) return;

    // Update version badge text across the site (e.g. "v0.1.12")
    const versionTag = release.tag_name || release.name || '';
    if (versionTag) {
      document.querySelectorAll('.version-badge, [data-latest-version]').forEach(el => {
        el.textContent = versionTag;
      });
    }

    // Parse assets dynamically matching current build conventions
    const assets = release.assets || [];
    const findAssetUrl = (predicate) => {
      const match = assets.find(predicate);
      return match ? match.browser_download_url : null;
    };

    latestAssets.windowsExe = findAssetUrl(a => a.name.endsWith('.exe') && !a.name.endsWith('.sig')) || latestAssets.windowsExe;
    latestAssets.macArm = findAssetUrl(a => (a.name.includes('aarch64') || a.name.includes('arm64')) && a.name.endsWith('.dmg') && !a.name.endsWith('.sig')) || latestAssets.macArm;
    latestAssets.macIntel = findAssetUrl(a => (a.name.includes('x86_64') || a.name.includes('x64')) && a.name.includes('darwin') && a.name.endsWith('.dmg') && !a.name.endsWith('.sig')) || latestAssets.macIntel;
    latestAssets.linuxAppImage = findAssetUrl(a => a.name.endsWith('.AppImage') && !a.name.endsWith('.sig')) || latestAssets.linuxAppImage;
    latestAssets.linuxDeb = findAssetUrl(a => a.name.endsWith('.deb') && !a.name.endsWith('.sig')) || latestAssets.linuxDeb;
    latestAssets.linuxRpm = findAssetUrl(a => a.name.endsWith('.rpm') && !a.name.endsWith('.sig')) || latestAssets.linuxRpm;
    latestAssets.tarArchive = findAssetUrl(a => a.name.endsWith('.tar.gz') && !a.name.endsWith('.sig')) || latestAssets.tarArchive;

    // Update all direct download buttons in the page
    document.querySelectorAll('[data-download-key]').forEach(el => {
      const key = el.getAttribute('data-download-key');
      if (latestAssets[key] && latestAssets[key] !== RELEASES_PAGE_URL) {
        el.href = latestAssets[key];
      }
    });

    // Re-apply Hero button with resolved assets
    applyHeroOS(currentDetectedOS);

    // Update credit year from release timestamp if available
    if (release.published_at || release.created_at) {
      const pubYear = extractYearFromDateString(release.published_at || release.created_at);
      if (pubYear) updateCreditYear(pubYear);
    }
  }

  async function fetchLatestReleaseAssets() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        try {
          const cached = JSON.parse(raw);
          if (cached && cached.timestamp && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
            return;
          }
        } catch (e) {}
      }

      const requestFn = s0?.restApi?.fetch || s0?.fetch || fetch;
      const res = await requestFn(RELEASES_API_URL, {
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

      const release = await res.json();
      if (release && release.tag_name) {
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            data: release,
            timestamp: Date.now()
          }));
        } catch (cacheErr) {
          console.debug('Could not write release to localStorage', cacheErr);
        }

        applyReleaseData(release);
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
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        const pubDate = cached?.data?.published_at || cached?.data?.created_at;
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

  // Register with Stage0 global registry
  if (s0 && typeof s0.__defineModule === 'function') {
    s0.__defineModule('releases', {
      detectUserOS,
      applyHeroOS,
      initOsDetection,
      initCachedRelease,
      applyReleaseData,
      fetchLatestReleaseAssets,
      initDynamicCreditYear,
      latestAssets,
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
      detectUserOS,
      applyHeroOS,
      initOsDetection,
      initCachedRelease,
      applyReleaseData,
      fetchLatestReleaseAssets,
      initDynamicCreditYear,
      latestAssets,
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

