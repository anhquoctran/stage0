export function detectUserOS(navigator = globalThis.navigator || {}) {
  const ua = (navigator.userAgent || '').toLowerCase();
  const platform = (navigator.platform || '').toLowerCase();
  const clientPlatform = (navigator.userAgentData?.platform || '').toLowerCase();
  const isIPadDesktopMode =
    platform.includes('mac') && Number(navigator.maxTouchPoints) > 1 && ua.includes('macintosh');

  // iPadOS may expose MacIntel in desktop mode. Do not recommend a macOS installer.
  if (/iphone|ipad|ipod/.test(ua) || clientPlatform.includes('ios') || isIPadDesktopMode) {
    return 'ios';
  }
  if (ua.includes('android') || clientPlatform.includes('android')) return 'android';

  // Prefer explicit UA OS tokens. Responsive-mode UA overrides may change the
  // requested device while navigator.platform still describes the host machine.
  if (
    ua.includes('windows') ||
    ua.includes('win32') ||
    ua.includes('win64') ||
    ua.includes('wow64')
  )
    return 'windows';
  if (ua.includes('macintosh') || ua.includes('mac os x') || ua.includes('darwin')) return 'macos';
  if (
    ua.includes('linux') ||
    ua.includes('x11') ||
    ua.includes('ubuntu') ||
    ua.includes('debian') ||
    ua.includes('fedora')
  )
    return 'linux';

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

export function normalizeMacArchitecture(architecture, bitness) {
  const value = String(architecture || '').toLowerCase();
  const bits = String(bitness || '').toLowerCase();
  if (/^(arm|arm64|aarch64)$/.test(value) && bits !== '32') return 'arm64';
  if (/^(x86|x86_64|x64|amd64)$/.test(value) && bits !== '32') return 'x86_64';
  return null;
}

export function normalizeArchitecture(architecture, bitness) {
  const value = String(architecture || '').toLowerCase();
  const bits = String(bitness || '').toLowerCase();
  if (/^(arm|arm64|aarch64)$/.test(value) && bits !== '32') return 'arm64';
  if (/^(x86_64|x64|amd64)$/.test(value) && bits !== '32') return 'x64';
  if (value === 'x86' && bits === '64') return 'x64';
  return null;
}

export async function detectArchitecture(
  osName,
  navigator = globalThis.navigator || {},
  document = globalThis.document,
) {
  if (osName === 'macos') {
    const macArchitecture = await detectMacArchitecture(navigator, document);
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

export function detectMacArchitectureFromRenderer(document = globalThis.document) {
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

export function detectLinuxDownloadKey(navigator = globalThis.navigator || {}) {
  const ua = (navigator.userAgent || '').toLowerCase();
  if (/\b(ubuntu|debian|linux mint|linuxmint|pop!?_?os|pop os|elementary os)\b/.test(ua)) {
    return 'linuxDeb';
  }
  if (/\b(fedora|rhel|red hat|centos|rocky|alma|opensuse|open suse|suse)\b/.test(ua)) {
    return 'linuxRpm';
  }
  return 'linuxAppImage';
}

export async function detectMacArchitecture(
  navigator = globalThis.navigator || {},
  document = globalThis.document,
) {
  const rendererArchitecture = detectMacArchitectureFromRenderer(document);
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

export async function detectDevice(
  navigator = globalThis.navigator,
  document = globalThis.document,
) {
  const os = detectUserOS(navigator);
  return {
    os,
    arch: await detectArchitecture(os, navigator, document),
    linuxKey: detectLinuxDownloadKey(navigator),
  };
}
