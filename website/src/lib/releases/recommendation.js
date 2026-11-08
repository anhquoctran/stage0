import { ARCHIVE_URL, formatAssetSize, matchingAssets, releaseChannelFromTag } from './catalog.js';

export const downloadFormats = {
  windowsExe: ['windows', 'x64', '.exe'],
  windowsArm64: ['windows', 'arm64', '.exe'],
  macArm: ['macos', 'arm64', '.dmg'],
  macIntel: ['macos', 'x64', '.dmg'],
  linuxAppImage: ['linux', 'x64', '.AppImage'],
  linuxDeb: ['linux', 'x64', '.deb'],
  linuxRpm: ['linux', 'x64', '.rpm'],
};

export function downloadFor(release, key) {
  if (key === 'tarArchive') {
    const archive = (release?.assets || []).find(
      (asset) => asset.name.includes('unknown-linux') && asset.name.endsWith('.tar.gz'),
    );
    return archive
      ? {
          name: archive.name,
          url: archive.browser_download_url,
          size: formatAssetSize(archive.size),
        }
      : { url: release?.html_url || ARCHIVE_URL, size: '' };
  }
  const [os, arch, format] = downloadFormats[key] || [];
  const asset = matchingAssets(release, os, arch).find((asset) => asset.format === format);
  return asset || { url: release?.html_url || ARCHIVE_URL, size: '' };
}

export function recommendedKey(device) {
  if (device.os === 'macos')
    return device.arch === 'arm64' ? 'macArm' : device.arch === 'x64' ? 'macIntel' : null;
  if (device.os === 'linux') return device.arch === 'x64' ? device.linuxKey : null;
  return device.os === 'windows' ? (device.arch === 'arm64' ? 'windowsArm64' : 'windowsExe') : null;
}

export function stableRecommendation(catalog, device) {
  const stable = catalog.filter((release) => releaseChannelFromTag(release.tag_name) === 'stable');
  const os = ['windows', 'macos', 'linux'].includes(device.os) ? device.os : 'windows';
  const arch = os === 'windows' && device.os !== 'windows' ? 'x64' : device.arch;
  const text = `Download for ${{ windows: 'Windows', macos: 'macOS', linux: 'Linux' }[os]}`;
  const icon = {
    windows: 'fa-brands fa-windows',
    macos: 'fa-brands fa-apple',
    linux: 'fa-brands fa-linux',
  }[os];
  const fallback = {
    url: stable[0]?.html_url || `${ARCHIVE_URL}/latest`,
    text,
    icon,
    label:
      os === 'macos' && !arch
        ? '(Choose Apple Silicon or Intel below)'
        : '(Browse stable downloads)',
  };
  const formats =
    os !== 'linux'
      ? [os === 'macos' ? '.dmg' : '.exe']
      : device.linuxKey === 'linuxDeb'
        ? ['.deb', '.AppImage', '.rpm']
        : device.linuxKey === 'linuxRpm'
          ? ['.rpm', '.AppImage', '.deb']
          : ['.AppImage', '.deb', '.rpm'];
  for (const format of formats)
    for (const release of stable) {
      const asset = matchingAssets(release, os, arch).find((asset) => asset.format === format);
      if (asset && arch)
        return {
          url: asset.url,
          text,
          icon,
          label: `(${arch === 'arm64' ? 'ARM64' : os === 'windows' ? '64-bit' : 'x64'} ${asset.format}${asset.size ? ` · ${asset.size}` : ''})`,
        };
    }
  return fallback;
}
