export const GITHUB_REPO = 'anhquoctran/stage0';
export const ARCHIVE_URL = 'https://github.com/' + GITHUB_REPO + '/releases';
export const API_URL = 'https://api.github.com/repos/' + GITHUB_REPO + '/releases';
export function releaseChannelFromTag(tag) {
  if (/^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(String(tag || ''))) return 'stable';
  const match = String(tag || '').match(
    /^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)-(nightly|beta)(?:\.[1-9]\d{7}\.(?:0|[1-9]\d*))?$/,
  );
  return match?.[1] || null;
}

export function classifyAsset(asset) {
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
    iconClass: {
      windows: 'fa-brands fa-windows',
      macos: 'fa-brands fa-apple',
      linux: 'fa-brands fa-linux',
    }[os],
    formatLabel,
    label: `${osLabels[os]} ${archLabels[arch]} · ${formatLabel}`,
  };
}

export function formatAssetSize(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`;
  const unit = bytes >= 1024 ** 3 ? 'GB' : 'MB';
  const divisor = unit === 'GB' ? 1024 ** 3 : 1024 ** 2;
  return `${(bytes / divisor).toFixed(1).replace(/\.0$/, '')} ${unit}`;
}

export function formatAssetDigest(value) {
  const match = String(value || '')
    .trim()
    .match(/^sha256:([a-f\d]{64})$/i);
  return match ? match[1].toLowerCase() : '';
}

export function isTrustedReleaseUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'github.com' &&
      url.pathname.startsWith(`/` + GITHUB_REPO + `/releases/`)
    );
  } catch {
    return false;
  }
}

export function sanitizeReleases(input) {
  return (Array.isArray(input) ? input : [])
    .filter((release) => !release?.draft && releaseChannelFromTag(release?.tag_name))
    .map((release) => ({
      tag_name: release.tag_name,
      html_url: isTrustedReleaseUrl(release.html_url)
        ? release.html_url
        : `${ARCHIVE_URL}/tag/${encodeURIComponent(release.tag_name)}`,
      published_at: release.published_at || release.created_at || '',
      assets: (Array.isArray(release.assets) ? release.assets : []).filter((asset) =>
        isTrustedReleaseUrl(asset?.browser_download_url),
      ),
    }));
}

export function matchingAssets(release, os = 'all', arch = 'all') {
  return (release?.assets || [])
    .map(classifyAsset)
    .filter(
      (asset) =>
        asset && (os === 'all' || asset.os === os) && (arch === 'all' || asset.arch === arch),
    )
    .sort(
      (a, b) =>
        ['linux', 'macos', 'windows'].indexOf(a.os) - ['linux', 'macos', 'windows'].indexOf(b.os) ||
        ['arm64', 'x64'].indexOf(a.arch) - ['arm64', 'x64'].indexOf(b.arch) ||
        a.formatLabel.localeCompare(b.formatLabel, 'en'),
    );
}

export function pageNumbers(page, total) {
  const candidates = new Set([1, total, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((value) => candidates.add(value));
  if (page >= total - 2)
    [total - 3, total - 2, total - 1].forEach((value) => candidates.add(value));
  const pages = [...candidates]
    .filter((value) => value >= 1 && value <= total)
    .sort((a, b) => a - b);
  return pages.flatMap((value, index) =>
    index && value - pages[index - 1] > 1 ? ['gap-' + value, value] : [value],
  );
}
