/**
 * Software Update API Service (Mock Implementation)
 * Calls update version management API with query parameters:
 *   - current_version: <current_semver>
 *   - os_name: os name in lowercase (windows | macos | linux)
 *   - arch_name: arch name in lowercase (amd64 | aarch64 | i386 | arm)
 * 
 * Always returns HTTP 200 with standardized response code.
 */

import {
  UpdateCheckParams,
  UpdateCheckResponse,
  MockScenario,
} from '../types/update';

// Default endpoint URL placeholder (will be replaced when backend JSON schema & URL are provided)
export const DEFAULT_UPDATE_API_URL = 'https://api.stage0.dev/v1/updates/check';

/**
 * Builds the canonical update request query URL
 */
export function buildUpdateCheckUrl(
  baseUrl: string,
  params: UpdateCheckParams
): string {
  const url = new URL(baseUrl);
  url.searchParams.set('current_version', params.current_version);
  url.searchParams.set('os_name', params.os_name.toLowerCase());
  url.searchParams.set('arch_name', params.arch_name.toLowerCase());
  return url.toString();
}

/**
 * Mock data generator for testing update checks
 */
export function generateMockUpdateResponse(
  params: UpdateCheckParams,
  scenario: MockScenario = 'available'
): UpdateCheckResponse {
  const os = params.os_name.toLowerCase();
  const arch = params.arch_name.toLowerCase();

  if (scenario === 'error') {
    return {
      code: 'CHECK_ERROR',
      message: 'Failed to connect to version management server. Network timeout.',
      data: null,
    };
  }

  if (scenario === 'up_to_date') {
    return {
      code: 'UP_TO_DATE',
      message: 'Stage0 is up to date. You are running the latest version.',
      data: {
        latestVersion: params.current_version,
        packageVersion: `${params.current_version}+1741ef3.${os}.${arch}`,
        releaseDate: new Date().toISOString().split('T')[0],
        downloadUrl: '',
      },
    };
  }

  // Scenario 'available': Newer version available
  const ext = os === 'windows' ? '.exe' : os === 'macos' ? '.dmg' : '.AppImage';
  const latestVer = '0.2.0';

  return {
    code: 'UPDATE_AVAILABLE',
    message: `A new version of Stage0 (${latestVer}) is available.`,
    data: {
      latestVersion: latestVer,
      packageVersion: `${latestVer}+9b31d8e.${os}.${arch}`,
      releaseDate: '2026-10-15',
      downloadUrl: `https://releases.stage0.dev/v${latestVer}/stage0-${latestVer}-${os}-${arch}${ext}`,
      sha256: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
      fileSize: '48.6 MB',
      mandatory: false,
      releaseNotes: [
        '• Automated in-app software updater with seamless restart',
        '• Enhanced Virtual MR branch comparison engine and conflict predictor',
        '• Added Architecture Sentinel and Clean Architecture bot reviewer models',
        '• Improved multi-column keyboard shortcut reference sheet',
        '• Fixed dark and light theme contrast across all dialogs and modals',
      ].join('\n'),
    },
  };
}

/**
 * Checks for updates against the version management API.
 * Currently uses simulated mock response with configurable scenarios.
 */
export async function fetchUpdateCheck(
  params: UpdateCheckParams,
  scenario: MockScenario = 'available',
  apiUrl: string = DEFAULT_UPDATE_API_URL
): Promise<UpdateCheckResponse> {
  const queryUrl = buildUpdateCheckUrl(apiUrl, params);
  console.log(`[UpdateService] Checking for updates via: ${queryUrl}`);

  // Simulate network latency (400ms - 800ms)
  await new Promise((resolve) => setTimeout(resolve, 600));

  // In mock mode, generate standard response according to selected test scenario
  return generateMockUpdateResponse(params, scenario);
}

/**
 * Simulates streaming download of the update binary payload with progress events
 */
export function simulateDownloadPayload(
  onProgress: (percent: number, speed: string, downloadedBytes: string) => void,
  onComplete: () => void,
  _onError?: (err: string) => void,
  signal?: AbortSignal
): () => void {
  let progress = 0;
  const totalMB = 48.6;
  let isCancelled = false;

  const interval = setInterval(() => {
    if (signal?.aborted || isCancelled) {
      clearInterval(interval);
      return;
    }

    // Increment progress by 5-12% each tick
    progress += Math.floor(Math.random() * 8) + 5;
    if (progress >= 100) {
      progress = 100;
      clearInterval(interval);
      onProgress(100, '0 MB/s', `${totalMB} MB / ${totalMB} MB`);
      setTimeout(onComplete, 400);
      return;
    }

    const downloaded = ((progress / 100) * totalMB).toFixed(1);
    const speed = (Math.random() * 3 + 3.5).toFixed(1); // 3.5 - 6.5 MB/s
    onProgress(progress, `${speed} MB/s`, `${downloaded} MB / ${totalMB} MB`);
  }, 250);

  return () => {
    isCancelled = true;
    clearInterval(interval);
  };
}
