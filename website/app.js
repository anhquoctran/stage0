// Stage0 Landing Page Interactive Script

// GitHub repository info for dynamic public API lookup
const GITHUB_REPO = 'anhquoctran/stage0';
const RELEASES_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const RELEASES_PAGE_URL = `https://github.com/${GITHUB_REPO}/releases/latest`;
const CACHE_KEY = 'stage0_latest_release_cache';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache to stay well within GitHub API rate limits (60 req/hr)

// Dynamic latest asset direct URLs map with GitHub releases fallback
const latestAssets = {
  windowsExe: RELEASES_PAGE_URL,
  macArm: RELEASES_PAGE_URL,
  macIntel: RELEASES_PAGE_URL,
  linuxAppImage: RELEASES_PAGE_URL,
  linuxDeb: RELEASES_PAGE_URL,
  linuxRpm: RELEASES_PAGE_URL,
  tarArchive: RELEASES_PAGE_URL
};

let currentDetectedOS = 'windows';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initCachedRelease();
  initOsDetection();
  initMobileMenu();
  initComparisonFilter();
  initMockupTabs();
  initDistroTabs();
  initCopyButtons();
  initFaqAccordion();
  fetchLatestReleaseAssets();
});

// 1. Theme Management (Mocha / Latte)
function initTheme() {
  const themeToggle = document.getElementById('theme-toggle');
  const savedTheme = localStorage.getItem('stage0_theme') || 
    (window.matchMedia('(prefers-color-scheme: light)').matches ? 'latte' : 'mocha');
  
  applyTheme(savedTheme);

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'mocha';
      const nextTheme = current === 'mocha' || current === 'dark' ? 'latte' : 'mocha';
      applyTheme(nextTheme);
      localStorage.setItem('stage0_theme', nextTheme);
    });
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const themeIcon = document.getElementById('theme-icon');
  if (themeIcon) {
    if (theme === 'latte' || theme === 'light') {
      themeIcon.className = 'fa-solid fa-sun';
    } else {
      themeIcon.className = 'fa-solid fa-moon';
    }
  }
}


// 2. OS Auto-Detection for Hero CTA
function detectUserOS() {
  // 1. Modern Client Hints (Chromium: Chrome, Edge, Brave, Opera)
  if (navigator.userAgentData && navigator.userAgentData.platform) {
    const p = navigator.userAgentData.platform.toLowerCase();
    if (p.includes('win')) return 'windows';
    if (p.includes('mac')) return 'macos';
    if (p.includes('linux')) return 'linux';
  }

  // 2. Check navigator.platform
  const platform = (navigator.platform || '').toLowerCase();
  if (platform.includes('win')) return 'windows';
  if (platform.includes('mac') || platform.includes('iphone') || platform.includes('ipad')) return 'macos';
  if (platform.includes('linux') || platform.includes('x11')) return 'linux';

  // 3. Check navigator.userAgent
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

  // Reset highlight cards - strictly readonly automatic selection
  [windowsCard, macCard, linuxCard].forEach(c => {
    if (!c) return;
    c.classList.remove('highlight');
  });

  if (osName === 'macos') {
    if (macCard) macCard.classList.add('highlight');
    if (heroOsIcon) heroOsIcon.className = 'fa-brands fa-apple';
    if (heroBtnText) heroBtnText.textContent = 'Download for macOS';
    if (heroPlatformLabel) heroPlatformLabel.textContent = '(Apple Silicon / Intel .dmg)';
    if (heroDownloadBtn) heroDownloadBtn.href = latestAssets.macArm;
  } else if (osName === 'linux') {
    if (linuxCard) linuxCard.classList.add('highlight');
    if (heroOsIcon) heroOsIcon.className = 'fa-brands fa-linux';
    if (heroBtnText) heroBtnText.textContent = 'Download for Linux';
    if (heroPlatformLabel) heroPlatformLabel.textContent = '(.AppImage, .deb, .rpm)';
    if (heroDownloadBtn) heroDownloadBtn.href = latestAssets.linuxAppImage;
  } else {
    // Windows default
    if (windowsCard) windowsCard.classList.add('highlight');
    if (heroOsIcon) heroOsIcon.className = 'fa-brands fa-windows';
    if (heroBtnText) heroBtnText.textContent = 'Download for Windows';
    if (heroPlatformLabel) heroPlatformLabel.textContent = '(64-bit .exe)';
    if (heroDownloadBtn) heroDownloadBtn.href = latestAssets.windowsExe;
  }
}

function initOsDetection() {
  const detected = detectUserOS();
  applyHeroOS(detected);
}

// 3. Dynamic Version & Asset Resolver from GitHub API
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

  // 1. Update version badge text across the site (e.g. "v0.1.12")
  const versionTag = release.tag_name || release.name || '';
  if (versionTag) {
    document.querySelectorAll('.version-badge, [data-latest-version]').forEach(el => {
      el.textContent = versionTag;
    });
  }

  // 2. Parse assets dynamically matching current build conventions
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

  // 3. Update all direct download buttons in the page
  document.querySelectorAll('[data-download-key]').forEach(el => {
    const key = el.getAttribute('data-download-key');
    if (latestAssets[key] && latestAssets[key] !== RELEASES_PAGE_URL) {
      el.href = latestAssets[key];
    }
  });

  // 4. Re-apply Hero button with resolved assets
  applyHeroOS(currentDetectedOS);
}

async function fetchLatestReleaseAssets() {
  try {
    // Check if cached release is still fresh
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      try {
        const cached = JSON.parse(raw);
        if (cached && cached.timestamp && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
          // Cache is fresh, UI already populated by initCachedRelease()
          return;
        }
      } catch (e) {}
    }

    const res = await fetch(RELEASES_API_URL);
    if (!res.ok) {
      console.warn(`GitHub Releases API responded with status ${res.status}`);
      return;
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

// 4. Interactive UI Mockup Tabs
function initMockupTabs() {
  const tabs = document.querySelectorAll('[data-mockup-tab]');
  const views = {
    diff: document.getElementById('mockup-view-diff'),
    ai: document.getElementById('mockup-view-ai')
  };

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-mockup-tab');
      
      // Update tab active state
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Update views
      Object.keys(views).forEach(k => {
        if (views[k]) {
          views[k].style.display = (k === target) ? 'block' : 'none';
        }
      });
    });
  });
}

// 5. Linux Distro Installation Tabs
function initDistroTabs() {
  const tabs = document.querySelectorAll('[data-distro-tab]');
  const codes = document.querySelectorAll('[data-distro-code]');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-distro-tab');
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      codes.forEach(c => {
        c.style.display = (c.getAttribute('data-distro-code') === target) ? 'flex' : 'none';
      });
    });
  });
}

// 6. Code Block Copy Buttons
function initCopyButtons() {
  const copyBtns = document.querySelectorAll('.copy-btn');
  copyBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const codeTargetId = btn.getAttribute('data-copy-target');
      const targetEl = document.getElementById(codeTargetId);
      const textToCopy = targetEl ? targetEl.textContent.trim() : btn.getAttribute('data-copy-text');

      if (!textToCopy) return;

      try {
        await navigator.clipboard.writeText(textToCopy);
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
        btn.style.backgroundColor = '#16a34a';
        btn.style.color = '#ffffff';

        setTimeout(() => {
          btn.innerHTML = originalHtml;
          btn.style.backgroundColor = '';
          btn.style.color = '';
        }, 2000);
      } catch (err) {
        console.error('Failed to copy to clipboard', err);
      }
    });
  });
}

// 7. FAQ Accordion
function initFaqAccordion() {
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const questionBtn = item.querySelector('.faq-question');
    if (questionBtn) {
      questionBtn.addEventListener('click', () => {
        const isOpen = item.classList.contains('open');
        // Close others
        faqItems.forEach(other => other.classList.remove('open'));
        if (!isOpen) {
          item.classList.add('open');
        }
      });
    }
  });
}

// 8. Mobile Navigation Drawer
function initMobileMenu() {
  const toggleBtn = document.getElementById('mobile-menu-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  if (!toggleBtn || !mobileMenu) return;

  const icon = toggleBtn.querySelector('i');

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = mobileMenu.classList.toggle('open');
    if (icon) {
      icon.className = isOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
    }
  });

  // Close when clicking any mobile link
  mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      mobileMenu.classList.remove('open');
      if (icon) icon.className = 'fa-solid fa-bars';
    });
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (mobileMenu.classList.contains('open') && !mobileMenu.contains(e.target) && !toggleBtn.contains(e.target)) {
      mobileMenu.classList.remove('open');
      if (icon) icon.className = 'fa-solid fa-bars';
    }
  });
}

// 9. Mobile Comparison Dimension Filter
function initComparisonFilter() {
  const filterBtns = document.querySelectorAll('[data-comp-filter]');
  const altRows = document.querySelectorAll('[data-comp-target]');
  if (!filterBtns.length || !altRows.length) return;

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.getAttribute('data-comp-filter');
      
      // Update active pill button
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Filter comparison rows
      altRows.forEach(row => {
        const target = row.getAttribute('data-comp-target');
        if (filter === 'all' || filter === target) {
          row.style.display = 'flex';
        } else {
          row.style.display = 'none';
        }
      });
    });
  });
}


