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
    toggle: (value, force) => {
      if (force === undefined ? !values.has(value) : force) values.add(value);
      else values.delete(value);
      return values.has(value);
    },
  };
}

function fixture({ userAgent = '', platform = '', maxTouchPoints = 0, userAgentData, webglRenderer, releasesResponse = [] } = {}) {
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
    href: '',
    getAttribute(name) { return name === 'data-download-key' ? this.key : this.attributes[name]; },
    setAttribute(name, value) { this.attributes[name] = value; },
  }]));
  const sizeKeys = [...downloadKeys, 'tarArchive'];
  const assetSizeLabels = Object.fromEntries(sizeKeys.map((key) => [key, {
    key,
    textContent: '',
    hidden: true,
    getAttribute(name) { return name === 'data-asset-size-for' ? this.key : null; },
  }]));
  const channelButtons = Object.fromEntries(['stable', 'beta', 'nightly'].map((channel) => [channel, {
    channel,
    classList: classList(),
    attributes: { 'data-release-channel': channel },
    getAttribute(name) { return this.attributes[name]; },
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, listener) { if (name === 'click') this.click = listener; },
  }]));
  const versionOptions = {
    options: [],
    replaceChildren(...options) { this.options = options; },
  };
  const versionPicker = {
    open: false,
    classList: classList(),
    addEventListener(name, listener) { this.listeners ??= {}; this.listeners[name] = listener; },
  };
  const versionTrigger = {
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    focus() {},
  };
  const versionLabel = { textContent: '' };
  const makeOption = () => ({
    classList: classList(),
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    getAttribute(name) { return this.attributes[name]; },
    addEventListener(name, listener) { if (name === 'click') this.click = listener; },
  });
  const elements = {
    'hero-download-btn': {
      href: '',
      attributes: {},
      setAttribute(name, value) { this.attributes[name] = value; },
    },
    'hero-btn-text': { textContent: '' },
    'hero-platform-label': { textContent: '' },
    'hero-os-icon': { className: '' },
    'release-version-picker': versionPicker,
    'release-version-trigger': versionTrigger,
    'release-version-label': versionLabel,
    'release-version-options': versionOptions,
    'release-channel-status': { textContent: '' },
    'selected-release-link': { href: '' },
    'version-badge': { textContent: '' },
    ...cards,
  };
  const document = {
    getElementById: (id) => elements[id] ?? null,
    createElement: (tagName) => tagName === 'button'
      ? makeOption()
      : tagName === 'canvas' && webglRenderer
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
    querySelectorAll: (selector) => {
      if (selector === '.download-recommended') return Object.values(downloads).filter((button) => button.classList.contains('download-recommended'));
      if (selector === '[data-release-channel]') return Object.values(channelButtons);
      if (selector === '[data-download-key]') return Object.values(downloads);
      if (selector === '[data-asset-size-for]') return Object.values(assetSizeLabels);
      if (selector === '.release-version-option') return versionOptions.options;
      if (selector === '.version-badge, [data-latest-version]') return [elements['version-badge']];
      return [];
    },
  };
  const stage0 = {
    getConstant: (_key, fallback) => fallback,
    __defineModule(name, module) { this[name] = module; },
    __defineFunction() {},
  };
  const window = { Stage0: stage0 };
  const navigator = { userAgent, platform, maxTouchPoints, userAgentData };
  vm.runInNewContext(releasesSource, {
    window,
    navigator,
    document,
    localStorage: { getItem: () => null, setItem: () => {} },
    fetch: async () => ({
      ok: true,
      headers: { get: () => null },
      json: async () => releasesResponse,
    }),
    console: { debug: () => {}, warn: () => {} },
    Date,
    URL,
  });

  return { releases: window.Stage0.releases, cards, downloads, elements, channelButtons, versionOptions, assetSizeLabels };
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

test('Mac platform and user-agent evidence wins over conflicting Windows client hints', async () => {
  const view = fixture({
    platform: 'MacIntel',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.6 Safari/605.1.15',
    userAgentData: { platform: 'Windows' },
    webglRenderer: 'Apple M1 Pro',
  });
  view.releases.latestAssets.macArm = 'apple-silicon.dmg';

  await view.releases.initOsDetection();

  assert.equal(view.releases.currentDetectedOS, 'macos');
  assert.equal(view.elements['hero-btn-text'].textContent, 'Download for macOS');
  assert.equal(view.elements['hero-download-btn'].href, 'apple-silicon.dmg');
});

test('Firefox Linux UA overrides the Mac host platform in responsive device emulation', async () => {
  const fedora = fixture({
    platform: 'MacIntel',
    userAgent: 'Mozilla/5.0 (X11; Fedora; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0',
  });
  fedora.releases.latestAssets.linuxRpm = 'stage0.rpm';

  await fedora.releases.initOsDetection();

  assert.equal(fedora.releases.currentDetectedOS, 'linux');
  assert.equal(fedora.downloads.linuxRpm.classList.contains('download-recommended'), true);
  assert.equal(fedora.elements['hero-download-btn'].href, 'stage0.rpm');
  assert.equal(fedora.elements['hero-platform-label'].textContent, '(x64 .rpm)');
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

test('release browser switches channels and downloads the selected version assets', async () => {
  const stable = {
    tag_name: 'v0.0.4',
    html_url: 'https://github.com/anhquoctran/stage0/releases/tag/v0.0.4',
    assets: [{ name: 'x86_64-pc-windows-msvc-Stage0_0.0.4-setup.exe', browser_download_url: 'stable.exe', size: 104857600 }],
  };
  const betaLatest = {
    tag_name: 'v0.0.4-beta.20261031.2',
    html_url: 'https://github.com/anhquoctran/stage0/releases/tag/v0.0.4-beta.20261031.2',
    assets: [{ name: 'x86_64-pc-windows-msvc-Stage0_0.0.4-setup.exe', browser_download_url: 'beta-latest.exe', size: 2097152 }],
  };
  const betaOlder = {
    tag_name: 'v0.0.4-beta.20261024.1',
    html_url: 'https://github.com/anhquoctran/stage0/releases/tag/v0.0.4-beta.20261024.1',
    assets: [{ name: 'x86_64-pc-windows-msvc-Stage0_0.0.4-setup.exe', browser_download_url: 'beta-older.exe' }],
  };
  const nightly = {
    tag_name: 'v0.0.4-nightly.20261031.1',
    html_url: 'https://github.com/anhquoctran/stage0/releases/tag/v0.0.4-nightly.20261031.1',
    assets: [{ name: 'x86_64-pc-windows-msvc-Stage0_0.0.4-setup.exe', browser_download_url: 'nightly.exe' }],
  };
  const view = fixture({ releasesResponse: [stable, betaLatest, betaOlder, nightly] });

  await view.releases.fetchLatestReleaseAssets();
  assert.equal(view.releases.selectedRelease.tag_name, stable.tag_name);
  assert.equal(view.downloads.windowsExe.href, 'stable.exe');
  assert.equal(view.assetSizeLabels.windowsExe.textContent, '· 100 MB');

  view.channelButtons.beta.click();
  assert.equal(view.releases.selectedRelease.tag_name, betaLatest.tag_name);
  assert.equal(view.downloads.windowsExe.href, 'beta-latest.exe');
  assert.equal(view.assetSizeLabels.windowsExe.textContent, '· 2 MB');
  assert.equal(view.elements['selected-release-link'].href, betaLatest.html_url);

  view.versionOptions.options.find((option) => option.getAttribute('data-release-tag') === betaOlder.tag_name).click();
  assert.equal(view.releases.selectedRelease.tag_name, betaOlder.tag_name);
  assert.equal(view.downloads.windowsExe.href, 'beta-older.exe');

  view.channelButtons.nightly.click();
  assert.equal(view.releases.selectedRelease.tag_name, nightly.tag_name);
  assert.equal(view.downloads.windowsExe.href, 'nightly.exe');
});

test('hero quick download stays on the newest stable release when another channel is selected', async () => {
  const stable = {
    tag_name: 'v0.0.5',
    html_url: 'https://github.com/anhquoctran/stage0/releases/tag/v0.0.5',
    assets: [{ name: 'x86_64-pc-windows-msvc-Stage0_0.0.5-setup.exe', browser_download_url: 'stable-latest.exe' }],
  };
  const olderStable = {
    tag_name: 'v0.0.4',
    html_url: 'https://github.com/anhquoctran/stage0/releases/tag/v0.0.4',
    assets: [{ name: 'x86_64-pc-windows-msvc-Stage0_0.0.4-setup.exe', browser_download_url: 'stable-older.exe' }],
  };
  const beta = {
    tag_name: 'v0.0.6-beta.20261031.1',
    html_url: 'https://github.com/anhquoctran/stage0/releases/tag/v0.0.6-beta.20261031.1',
    assets: [{ name: 'x86_64-pc-windows-msvc-Stage0_0.0.6-setup.exe', browser_download_url: 'beta.exe' }],
  };
  const view = fixture({
    platform: 'Win32',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    releasesResponse: [beta, stable, olderStable],
  });

  await view.releases.initOsDetection();
  await view.releases.fetchLatestReleaseAssets();
  assert.equal(view.elements['hero-download-btn'].href, 'stable-latest.exe');

  view.channelButtons.beta.click();
  assert.equal(view.downloads.windowsExe.href, 'beta.exe');
  assert.equal(view.elements['hero-download-btn'].href, 'stable-latest.exe');
});

test('Windows ARM uses the newest stable ARM64 installer and mobile or unknown devices fall back to Windows x64', async () => {
  const latestStable = {
    tag_name: 'v0.0.5',
    assets: [{ name: 'x86_64-pc-windows-msvc-Stage0_x64-setup.exe', browser_download_url: 'windows-x64.exe' }],
  };
  const olderStable = {
    tag_name: 'v0.0.4',
    assets: [{ name: 'aarch64-pc-windows-msvc-Stage0_arm64-setup.exe', browser_download_url: 'windows-arm64.exe' }],
  };
  const newerBeta = {
    tag_name: 'v0.0.6-beta.20261031.1',
    assets: [{ name: 'aarch64-pc-windows-msvc-Stage0_arm64-setup.exe', browser_download_url: 'windows-beta-arm64.exe' }],
  };
  const armWindows = fixture({
    platform: 'Win32',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; ARM64)',
    userAgentData: {
      platform: 'Windows',
      getHighEntropyValues: async () => ({ architecture: 'arm', bitness: '64' }),
    },
    releasesResponse: [newerBeta, latestStable, olderStable],
  });
  await armWindows.releases.initOsDetection();
  await armWindows.releases.fetchLatestReleaseAssets();
  assert.equal(armWindows.elements['hero-download-btn'].href, 'windows-arm64.exe');
  assert.equal(armWindows.elements['hero-platform-label'].textContent, '(ARM64 .exe)');

  for (const device of [
    { platform: 'iPhone', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' },
    { platform: 'Linux armv8l', userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel)' },
    { platform: '', userAgent: 'Mozilla/5.0 (compatible; UnknownDevice)' },
  ]) {
    const view = fixture({ ...device, releasesResponse: [newerBeta, latestStable, olderStable] });
    await view.releases.initOsDetection();
    await view.releases.fetchLatestReleaseAssets();
    assert.equal(view.elements['hero-download-btn'].href, 'windows-x64.exe');
    assert.equal(view.elements['hero-btn-text'].textContent, 'Download for Windows');
    assert.equal(view.elements['hero-platform-label'].textContent, '(64-bit .exe)');
  }
});

test('Linux ARM selects a matching stable ARM64 package', async () => {
  const view = fixture({
    platform: 'Linux aarch64',
    userAgent: 'Mozilla/5.0 (X11; Ubuntu; Linux aarch64)',
    releasesResponse: [{
      tag_name: 'v0.0.5',
      assets: [
        { name: 'aarch64-unknown-linux-gnu-Stage0_arm64.deb', browser_download_url: 'linux-arm64.deb' },
        { name: 'x86_64-unknown-linux-gnu-Stage0.AppImage', browser_download_url: 'linux-x64.AppImage' },
      ],
    }],
  });

  await view.releases.initOsDetection();
  await view.releases.fetchLatestReleaseAssets();

  assert.equal(view.elements['hero-download-btn'].href, 'linux-arm64.deb');
  assert.equal(view.elements['hero-platform-label'].textContent, '(ARM64 .deb)');
});

test('an empty channel never leaves download buttons pointing at another channel', async () => {
  const view = fixture({ releasesResponse: [{
    tag_name: 'v0.0.4',
    html_url: 'https://github.com/anhquoctran/stage0/releases/tag/v0.0.4',
    assets: [{ name: 'x86_64-pc-windows-msvc-Stage0_0.0.4-setup.exe', browser_download_url: 'stable.exe' }],
  }] });

  await view.releases.fetchLatestReleaseAssets();
  view.channelButtons.beta.click();

  assert.equal(view.releases.selectedRelease, null);
  assert.equal(view.downloads.windowsExe.href, 'https://github.com/anhquoctran/stage0/releases');
  assert.equal(view.elements['selected-release-link'].href, 'https://github.com/anhquoctran/stage0/releases');
  assert.match(view.elements['release-channel-status'].textContent, /No beta releases/);
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
  assert.equal(ubuntuWithoutDeb.elements['hero-platform-label'].textContent, '(x64 .AppImage)');
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
  assert.equal(iPad.elements['hero-btn-text'].textContent, 'Download for Windows');
});
