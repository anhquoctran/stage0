import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('openUrl utility uses external link service and retains its browser fallback', () => {
  const utilSrc = readFileSync(
    new URL('../frontend/common/utils/openUrl.ts', import.meta.url),
    'utf-8'
  );

  assert.match(utilSrc, /externalLinks\.openExternalUrl\(/);
  const transport = readFileSync(new URL('../frontend/common/services/transport/createExternalLinkService.ts', import.meta.url), 'utf8');
  assert.match(transport, /executeCommand\('open_external_url'/);
  assert.match(utilSrc, /window\.open/);
  assert.match(utilSrc, /export function initExternalLinkInterceptor/);
});

test('AcpRegistryAbout links handle clicks to open external browser', () => {
  const aboutSrc = readFileSync(
    new URL('../frontend/features/ai/components/AcpRegistryAbout.tsx', import.meta.url),
    'utf-8'
  );

  assert.match(aboutSrc, /openUrl/);
  assert.match(aboutSrc, /handleLinkClick\('https:\/\/agentclientprotocol\.com\/get-started\/introduction'\)/);
  assert.match(aboutSrc, /handleLinkClick\('https:\/\/agentclientprotocol\.com\/get-started\/registry'\)/);
  assert.match(aboutSrc, /handleLinkClick\('https:\/\/cdn\.agentclientprotocol\.com\/registry\/v1\/latest\/registry\.json'\)/);
});

test('AcpRegistryProjectInfo links handle clicks to open external browser', () => {
  const infoSrc = readFileSync(
    new URL('../frontend/features/ai/components/AcpRegistryProjectInfo.tsx', import.meta.url),
    'utf-8'
  );

  assert.match(infoSrc, /openUrl/);
  assert.match(infoSrc, /onClick=\{handleLinkClick\(websiteUrl\)\}/);
  assert.match(infoSrc, /onClick=\{handleLinkClick\(repositoryUrl\)\}/);
  assert.match(infoSrc, /onClick=\{handleLinkClick\(licenseUrl\)\}/);
});

test('main.tsx registers global external link interceptor on startup', () => {
  const mainSrc = readFileSync(
    new URL('../frontend/main.tsx', import.meta.url),
    'utf-8'
  );

  assert.match(mainSrc, /initExternalLinkInterceptor/);
  assert.match(mainSrc, /initExternalLinkInterceptor\(\)/);
});

