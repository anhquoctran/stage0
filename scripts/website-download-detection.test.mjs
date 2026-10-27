import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const releasesSource = readFileSync(new URL('../website/js/releases.js', import.meta.url), 'utf8');

function classList() {
  const values = new Set();
  return {
    add: (value) => values.add(value),
    remove: (value) => values.delete(value),
    contains: (value) => values.has(value),
  };
}

function fixture({ userAgent = '', platform = '', maxTouchPoints = 0, userAgentData, webglRenderer } = {}) {
  const cards = Object.fromEntries(['windows', 'macos', 'linux'].map((os) => [
    `card-${os}`,
    {
      classList: classList(),
      badge: { textContent: 'Your OS' },
      querySelector: () => cards[`card-${os}`].badge,
    },
  ]));
  const downloadKeys = ['windowsExe', 'macArm', 'macIntel', 'linuxAppImage', 'linuxDeb', 'linuxRpm'];
  const downloads = Object.fromEntries(downloadKeys.map((key) => [key, {
    key,
    classList: classList(),
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
  }]));
  const elements = {
    'hero-download-btn': {
      href: '',
      attributes: {},
      setAttribute(name, value) { this.attributes[name] = value; },
    },
    'hero-btn-text': { textContent: '' },
    'hero-platform-label': { textContent: '' },
    'hero-os-icon': { className: '' },
    ...cards,
  };
  const document = {
    getElementById: (id) => elements[id] ?? null,
    createElement: (tagName) => tagName === 'canvas' && webglRenderer
      ? {
        getContext: () => ({
          RENDERER: 0x1f01,
          getExtension: () => ({ UNMASKED_RENDERER_WEBGL: 0x9246 }),
          getParameter: () => webglRenderer,
        }),
      }
      : { getContext: () => null },
    querySelector: (selector) => {
      const key = selector.match(/data-download-key="([^"]+)"/)?.[1];
      return key ? downloads[key] ?? null : null;
    },
    querySelectorAll: (selector) => selector === '.download-recommended'
      ? Object.values(downloads).filter((button) => button.classList.contains('download-recommended'))
      : [],
  };
  const window = { Stage0: { getConstant: (_key, fallback) => fallback } };
  const navigator = { userAgent, platform, maxTouchPoints, userAgentData };
  vm.runInNewContext(releasesSource, {
    window,
    navigator,
    document,
    localStorage: { getItem: () => null, setItem: () => {} },
    console: { debug: () => {} },
    Date,
    URL,
  });

  return { releases: window.Stage0.releases, cards, downloads, elements };
}

test('macOS ARM client hints highlight Apple Silicon and route the hero to that build', async () => {
  const view = fixture({
    platform: 'MacIntel',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/140 Safari/537.36',
    userAgentData: {
      platform: 'macOS',
      getHighEntropyValues: async () => ({ architecture: 'arm', bitness: '64' }),
    },
  });
  view.releases.latestAssets.macArm = 'apple-silicon.dmg';
  view.releases.latestAssets.macIntel = 'intel.dmg';

  await view.releases.initOsDetection();

  assert.equal(view.releases.currentDetectedOS, 'macos');
  assert.equal(view.cards['card-macos'].classList.contains('highlight'), true);
  assert.equal(view.downloads.macArm.classList.contains('download-recommended'), true);
  assert.equal(view.downloads.macIntel.classList.contains('download-recommended'), false);
  assert.equal(view.elements['hero-download-btn'].href, 'apple-silicon.dmg');
});

test('macOS Intel client hints highlight Intel and route the hero to that build', async () => {
  const view = fixture({
    platform: 'MacIntel',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15',
    userAgentData: {
      platform: 'macOS',
      getHighEntropyValues: async () => ({ architecture: 'x86', bitness: '64' }),
    },
  });
  view.releases.latestAssets.macArm = 'apple-silicon.dmg';
  view.releases.latestAssets.macIntel = 'intel.dmg';

  await view.releases.initOsDetection();

  assert.equal(view.downloads.macIntel.classList.contains('download-recommended'), true);
  assert.equal(view.downloads.macArm.classList.contains('download-recommended'), false);
  assert.equal(view.elements['hero-download-btn'].href, 'intel.dmg');
});

test('Safari renderer detection recommends Apple Silicon on an M-series Mac', async () => {
  const view = fixture({
    platform: 'MacIntel',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.6 Safari/605.1.15',
    webglRenderer: 'Apple M1 Pro',
  });
  view.releases.latestAssets.macArm = 'apple-silicon.dmg';
  view.releases.latestAssets.macIntel = 'intel.dmg';

  await view.releases.initOsDetection();

  assert.equal(view.downloads.macArm.classList.contains('download-recommended'), true);
  assert.equal(view.downloads.macIntel.classList.contains('download-recommended'), false);
  assert.equal(view.elements['hero-download-btn'].href, 'apple-silicon.dmg');
});

test('Safari renderer detection recommends Intel on an Intel Mac', async () => {
  const view = fixture({
    platform: 'MacIntel',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.6 Safari/605.1.15',
    webglRenderer: 'AMD Radeon Pro 5500M OpenGL Engine',
  });
  view.releases.latestAssets.macArm = 'apple-silicon.dmg';
  view.releases.latestAssets.macIntel = 'intel.dmg';

  await view.releases.initOsDetection();

  assert.equal(view.downloads.macIntel.classList.contains('download-recommended'), true);
  assert.equal(view.downloads.macArm.classList.contains('download-recommended'), false);
  assert.equal(view.elements['hero-download-btn'].href, 'intel.dmg');
});

test('Windows and Linux recommend their exact primary download buttons', async () => {
  const windows = fixture({ platform: 'Win32', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' });
  await windows.releases.initOsDetection();
  assert.equal(windows.downloads.windowsExe.classList.contains('download-recommended'), true);

  const linux = fixture({ platform: 'Linux x86_64', userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' });
  linux.releases.latestAssets.linuxAppImage = 'stage0.AppImage';
  await linux.releases.initOsDetection();
  assert.equal(linux.downloads.linuxAppImage.classList.contains('download-recommended'), true);
});

test('Linux distro hints highlight the matching package and use AppImage when the package is unavailable', async () => {
  const ubuntu = fixture({
    platform: 'Linux x86_64',
    userAgent: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0',
  });
  ubuntu.releases.latestAssets.linuxDeb = 'stage0.deb';
  ubuntu.releases.latestAssets.linuxAppImage = 'stage0.AppImage';
  await ubuntu.releases.initOsDetection();
  assert.equal(ubuntu.downloads.linuxDeb.classList.contains('download-recommended'), true);
  assert.equal(ubuntu.downloads.linuxAppImage.classList.contains('download-recommended'), false);
  assert.equal(ubuntu.elements['hero-download-btn'].href, 'stage0.deb');

  const fedora = fixture({
    platform: 'Linux x86_64',
    userAgent: 'Mozilla/5.0 (X11; Fedora; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0',
  });
  fedora.releases.latestAssets.linuxRpm = 'stage0.rpm';
  fedora.releases.latestAssets.linuxAppImage = 'stage0.AppImage';
  await fedora.releases.initOsDetection();
  assert.equal(fedora.downloads.linuxRpm.classList.contains('download-recommended'), true);
  assert.equal(fedora.elements['hero-download-btn'].href, 'stage0.rpm');

  const ubuntuWithoutDeb = fixture({
    platform: 'Linux x86_64',
    userAgent: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64) Chrome/140 Safari/537.36',
  });
  ubuntuWithoutDeb.releases.latestAssets.linuxAppImage = 'stage0.AppImage';
  await ubuntuWithoutDeb.releases.initOsDetection();
  assert.equal(ubuntuWithoutDeb.downloads.linuxAppImage.classList.contains('download-recommended'), true);
  assert.equal(ubuntuWithoutDeb.elements['hero-download-btn'].href, 'stage0.AppImage');
  assert.match(ubuntuWithoutDeb.elements['hero-platform-label'].textContent, /fallback/);
});

test('ambiguous Mac user agents do not guess a chip, and iPad desktop mode is not macOS', async () => {
  const unknownMac = fixture({
    platform: 'MacIntel',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/26 Safari/605.1.15',
  });
  await unknownMac.releases.initOsDetection();
  assert.equal(unknownMac.cards['card-macos'].badge.textContent, 'Choose your chip');
  assert.equal(unknownMac.downloads.macArm.classList.contains('download-recommended'), false);
  assert.equal(unknownMac.downloads.macIntel.classList.contains('download-recommended'), false);

  const iPad = fixture({
    platform: 'MacIntel',
    maxTouchPoints: 5,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
  });
  await iPad.releases.initOsDetection();
  assert.equal(iPad.releases.currentDetectedOS, 'ios');
  assert.equal(iPad.cards['card-macos'].classList.contains('highlight'), false);
  assert.equal(iPad.elements['hero-btn-text'].textContent, 'View desktop downloads');
});
