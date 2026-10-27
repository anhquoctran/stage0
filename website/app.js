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
  initDynamicCreditYear();
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

  // 5. Update credit year from release timestamp if available
  if (release.published_at || release.created_at) {
    const pubYear = extractYearFromDateString(release.published_at || release.created_at);
    if (pubYear) updateCreditYear(pubYear);
  }
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

// 4. Interactive UI Mockup Tabs & Controls (Stage0 Desktop Simulation)
function initMockupTabs() {
  const tabs = document.querySelectorAll('[data-mockup-tab]');
  const views = {
    diff: document.getElementById('mockup-view-diff'),
    ai: document.getElementById('mockup-view-ai'),
    conflict: document.getElementById('mockup-view-conflict'),
    commits: document.getElementById('mockup-view-commits')
  };

  // Switch subnav tabs
  function switchTab(target) {
    tabs.forEach(t => {
      if (t.getAttribute('data-mockup-tab') === target) {
        t.classList.add('active');
      } else {
        t.classList.remove('active');
      }
    });

    Object.keys(views).forEach(k => {
      if (views[k]) {
        views[k].style.display = (k === target) ? 'flex' : 'none';
      }
    });
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-mockup-tab');
      if (target) switchTab(target);
    });
  });

  // Sidebar File Item Click Switching
  const fileItems = document.querySelectorAll('.mockup-file-item');
  const fileNameDisplay = document.getElementById('mockup-file-name-display');

  const fileData = {
    auth: {
      name: 'auth_service.rs',
      crumb: 'auth',
      linesHtml: `
        <div class="diff-line diff-context">
          <span class="diff-num old">46</span><span class="diff-num new">46</span><span class="diff-sign">&nbsp;</span>
          <span class="diff-code"><span class="hl-cmt">/// Safely loads active token from persistent OS Keychain store</span></span>
        </div>
        <div class="diff-line diff-context">
          <span class="diff-num old">47</span><span class="diff-num new">47</span><span class="diff-sign">&nbsp;</span>
          <span class="diff-code"><span class="hl-cmt">/// Enforces zero-cost cryptographic zeroization upon Drop</span></span>
        </div>
        <div class="diff-line diff-context">
          <span class="diff-num old">48</span><span class="diff-num new">48</span><span class="diff-sign">&nbsp;</span>
          <span class="diff-code"><span class="hl-kw">pub fn</span> <span class="hl-fn">load_active_token</span>(vault: &amp;<span class="hl-type">TokenVault</span>) -&gt; <span class="hl-type">Result</span>&lt;<span class="hl-type">SecretToken</span>, <span class="hl-type">VaultError</span>&gt; {</span>
        </div>
        <div class="diff-line diff-del">
          <span class="diff-num old">49</span><span class="diff-num new">&nbsp;</span><span class="diff-sign">-</span>
          <span class="diff-code"><span class="hl-kw">let</span> raw_key = std::env::<span class="hl-fn">var</span>(<span class="hl-str">"APP_SECRET_TOKEN"</span>)?;</span>
        </div>
        <div class="diff-line diff-add">
          <span class="diff-num old">&nbsp;</span><span class="diff-num new">49</span><span class="diff-sign">+</span>
          <span class="diff-code"><span class="hl-kw">let</span> raw_key = vault.<span class="hl-fn">read_keychain_secret</span>(<span class="hl-str">"stage0_auth_token"</span>)?;</span>
        </div>
        <div class="diff-line diff-add">
          <span class="diff-num old">&nbsp;</span><span class="diff-num new">50</span><span class="diff-sign">+</span>
          <span class="diff-code"><span class="hl-kw">let</span> token = <span class="hl-type">SecretToken</span>::<span class="hl-fn">from_secure_bytes</span>(raw_key)?;</span>
        </div>
        <div class="diff-line diff-context">
          <span class="diff-num old">50</span><span class="diff-num new">51</span><span class="diff-sign">&nbsp;</span>
          <span class="diff-code"><span class="hl-type">Ok</span>(token)</span>
        </div>
        <div class="diff-line diff-context">
          <span class="diff-num old">51</span><span class="diff-num new">52</span><span class="diff-sign">&nbsp;</span>
          <span class="diff-code">}</span>
        </div>
      `,
      showAiCard: true
    },
    vault: {
      name: 'token_vault.rs',
      crumb: 'security',
      linesHtml: `
        <div class="diff-line diff-add">
          <span class="diff-num old">&nbsp;</span><span class="diff-num new">1</span><span class="diff-sign">+</span>
          <span class="diff-code"><span class="hl-cmt">//! Secure OS Native Keychain Store implementation for Stage0</span></span>
        </div>
        <div class="diff-line diff-add">
          <span class="diff-num old">&nbsp;</span><span class="diff-num new">2</span><span class="diff-sign">+</span>
          <span class="diff-code"><span class="hl-kw">pub struct</span> <span class="hl-type">TokenVault</span> { service_name: <span class="hl-type">String</span> }</span>
        </div>
        <div class="diff-line diff-add">
          <span class="diff-num old">&nbsp;</span><span class="diff-num new">3</span><span class="diff-sign">+</span>
          <span class="diff-code"><span class="hl-kw">impl</span> <span class="hl-type">TokenVault</span> {</span>
        </div>
        <div class="diff-line diff-add">
          <span class="diff-num old">&nbsp;</span><span class="diff-num new">4</span><span class="diff-sign">+</span>
          <span class="diff-code">    <span class="hl-kw">pub fn</span> <span class="hl-fn">read_keychain_secret</span>(&amp;self, key: &amp;<span class="hl-type">str</span>) -&gt; <span class="hl-type">Result</span>&lt;<span class="hl-type">Vec</span>&lt;<span class="hl-type">u8</span>&gt;, <span class="hl-type">VaultError</span>&gt; {</span>
        </div>
        <div class="diff-line diff-add">
          <span class="diff-num old">&nbsp;</span><span class="diff-num new">5</span><span class="diff-sign">+</span>
          <span class="diff-code">        <span class="hl-cmt">// Native Keychain retrieval with zero plaintext disk caching</span></span>
        </div>
        <div class="diff-line diff-add">
          <span class="diff-num old">&nbsp;</span><span class="diff-num new">6</span><span class="diff-sign">+</span>
          <span class="diff-code">        keyring::<span class="hl-type">Entry</span>::<span class="hl-fn">new</span>(&amp;self.service_name, key)?.<span class="hl-fn">get_secret</span>()</span>
        </div>
        <div class="diff-line diff-add">
          <span class="diff-num old">&nbsp;</span><span class="diff-num new">7</span><span class="diff-sign">+</span>
          <span class="diff-code">    }</span>
        </div>
        <div class="diff-line diff-add">
          <span class="diff-num old">&nbsp;</span><span class="diff-num new">8</span><span class="diff-sign">+</span>
          <span class="diff-code">}</span>
        </div>
      `,
      showAiCard: false
    },
    db: {
      name: 'migration.rs',
      crumb: 'db',
      linesHtml: `
        <div class="diff-line diff-context">
          <span class="diff-num old">14</span><span class="diff-num new">14</span><span class="diff-sign">&nbsp;</span>
          <span class="diff-code"><span class="hl-kw">pub fn</span> <span class="hl-fn">migrate_legacy_plaintext_tokens</span>(db: &amp;<span class="hl-type">Database</span>) -&gt; <span class="hl-type">Result</span>&lt;(), <span class="hl-type">DbError</span>&gt; {</span>
        </div>
        <div class="diff-line diff-del">
          <span class="diff-num old">15</span><span class="diff-num new">&nbsp;</span><span class="diff-sign">-</span>
          <span class="diff-code">    <span class="hl-cmt">// Remove unencrypted fallback column from SQLite cache</span></span>
        </div>
        <div class="diff-line diff-del">
          <span class="diff-num old">16</span><span class="diff-num new">&nbsp;</span><span class="diff-sign">-</span>
          <span class="diff-code">    db.<span class="hl-fn">execute</span>(<span class="hl-str">"ALTER TABLE auth_tokens DROP COLUMN plaintext_key;"</span>)?;</span>
        </div>
        <div class="diff-line diff-add">
          <span class="diff-num old">&nbsp;</span><span class="diff-num new">15</span><span class="diff-sign">+</span>
          <span class="diff-code">    <span class="hl-cmt">// Purge plaintext token column and verify OS vault pointer</span></span>
        </div>
        <div class="diff-line diff-add">
          <span class="diff-num old">&nbsp;</span><span class="diff-num new">16</span><span class="diff-sign">+</span>
          <span class="diff-code">    db.<span class="hl-fn">execute</span>(<span class="hl-str">"DROP TABLE IF EXISTS legacy_plaintext_tokens;"</span>)?;</span>
        </div>
        <div class="diff-line diff-context">
          <span class="diff-num old">17</span><span class="diff-num new">17</span><span class="diff-sign">&nbsp;</span>
          <span class="diff-code">    <span class="hl-type">Ok</span>(())</span>
        </div>
        <div class="diff-line diff-context">
          <span class="diff-num old">18</span><span class="diff-num new">18</span><span class="diff-sign">&nbsp;</span>
          <span class="diff-code">}</span>
        </div>
      `,
      showAiCard: false
    }
  };

  const diffLinesContainer = document.querySelector('.diff-lines-container');
  const aiReviewCard = document.querySelector('.ai-review-card');

  fileItems.forEach(item => {
    item.addEventListener('click', () => {
      fileItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      const fileKey = item.getAttribute('data-file-key');
      const data = fileData[fileKey];

      if (data) {
        if (fileNameDisplay) fileNameDisplay.textContent = data.name;
        if (diffLinesContainer) diffLinesContainer.innerHTML = data.linesHtml.trim();
        if (aiReviewCard) {
          aiReviewCard.style.display = data.showAiCard ? 'block' : 'none';
        }
        // Switch to diff view if user clicked a file
        switchTab('diff');
      }
    });
  });

  // Action: Apply Suggested Patch
  const btnApply = document.getElementById('mockup-btn-apply');
  if (btnApply) {
    btnApply.addEventListener('click', () => {
      btnApply.innerHTML = '<i class="fa-solid fa-check"></i> Patch Applied in Sandbox!';
      btnApply.style.backgroundColor = '#059669';
      btnApply.style.color = '#ffffff';

      const resolvedBadge = document.querySelector('.badge-resolved');
      if (resolvedBadge) {
        resolvedBadge.innerHTML = '<i class="fa-solid fa-check-double"></i> Patch Applied to Working Tree';
      }

      setTimeout(() => {
        btnApply.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Apply Suggested Patch';
        btnApply.style.backgroundColor = '';
        btnApply.style.color = '';
      }, 4000);
    });
  }

  // Action: Discuss with Sentinel -> Switch to AI Fleet Tab
  const btnDiscuss = document.getElementById('mockup-btn-discuss');
  if (btnDiscuss) {
    btnDiscuss.addEventListener('click', () => {
      switchTab('ai');
    });
  }

  // Action: Refresh Diff (Spin animation & instant feedback)
  const btnRefresh = document.getElementById('mockup-btn-refresh');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      const icon = btnRefresh.querySelector('i');
      if (icon) icon.classList.add('fa-spin');
      btnRefresh.disabled = true;

      setTimeout(() => {
        if (icon) icon.classList.remove('fa-spin');
        btnRefresh.disabled = false;
        btnRefresh.innerHTML = '<i class="fa-solid fa-check text-green"></i> Up to date (4.2ms)';
        setTimeout(() => {
          btnRefresh.innerHTML = '<i class="fa-solid fa-rotate"></i> Refresh';
        }, 2500);
      }, 600);
    });
  }

  // Copy Relative Path
  const btnCopyCrumb = document.querySelector('.btn-crumb-copy');
  if (btnCopyCrumb) {
    btnCopyCrumb.addEventListener('click', () => {
      const activeFile = fileNameDisplay ? fileNameDisplay.textContent : 'auth_service.rs';
      const fullRelPath = 'src/auth/' + activeFile;
      navigator.clipboard?.writeText(fullRelPath).then(() => {
        btnCopyCrumb.innerHTML = '<i class="fa-solid fa-check text-green"></i>';
        setTimeout(() => {
          btnCopyCrumb.innerHTML = '<i class="fa-regular fa-copy"></i>';
        }, 2000);
      });
    });
  }
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
        const isMatch = c.getAttribute('data-distro-code') === target;
        c.style.setProperty('display', isMatch ? 'flex' : 'none', 'important');
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
  // 1. Primary: Authoritative HTTP Date header from origin web server (same-origin HEAD request).
  // Standard RFC 9110 HTTP Date header is generated by the origin server in GMT, bypassing local clock.
  if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
    try {
      const headRes = await fetch(window.location.href, { method: 'HEAD', cache: 'no-store' });
      const serverDate = headRes.headers.get('date');
      if (serverDate) {
        const year = extractYearFromDateString(serverDate);
        if (year && updateCreditYear(year)) return;
      }
    } catch (e) {
      // Offline or network error
    }
  }

  // 2. Secondary: If cached release exists in localStorage, read its server published_at timestamp
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

  // 3. Fallback: If network is offline, guard against invalid local clock (e.g. 1970, 2010)
  const localYear = new Date().getFullYear();
  if (localYear >= 2026 && localYear <= 2099) {
    updateCreditYear(localYear);
  } else {
    updateCreditYear(2026);
  }
}
