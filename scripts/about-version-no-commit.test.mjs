import assert from 'node:assert/strict';
import test from 'node:test';
import { computeAboutInfo } from './generate-about-info.mjs';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';

test('About build metadata never includes a commit digest', () => {
  const previousCommit = process.env.GIT_COMMIT;
  process.env.GIT_COMMIT = 'deadbeef';

  try {
    const about = computeAboutInfo({ os: 'linux', arch: 'x64' });
    assert.equal(about.version, `${about.packageVersion}+linux.amd64`);
    assert.equal(Object.hasOwn(about, 'gitCommit'), false);
    assert.doesNotMatch(JSON.stringify(about), /deadbeef/);
  } finally {
    if (previousCommit === undefined) delete process.env.GIT_COMMIT;
    else process.env.GIT_COMMIT = previousCommit;
  }
});

test('About display and copied diagnostics omit a legacy commit digest', async () => {
  const harness = componentHarness();
  const originalWindow = globalThis.window;
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const originalTimeout = globalThis.setTimeout;
  let copiedText = '';
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  globalThis.setTimeout = () => 0;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { clipboard: { writeText: async (value) => { copiedText = value; } }, platform: 'Fixture OS' },
  });

  const about = {
    name: 'Stage0', version: '0.0.1+linux.amd64', packageVersion: '0.0.1',
    gitCommit: 'legacy-deadbeef', arch: 'amd64', author: 'Fixture', releaseDate: '2026-11-07',
    copyright: 'Fixture', license: 'MIT', description: 'Fixture', tagline: 'Fixture', website: 'https://example.test',
  };

  try {
    const mocks = {
      react: harness.react,
      '../hooks/useAboutInfo': { useAboutInfo: () => about },
      '../../../common/components/AppLogo': { AppLogo: () => null },
      '../../updates/components/SoftwareUpdatePanel': { SoftwareUpdatePanel: () => null },
    };
    for (const name of ['Check', 'Copy', 'X']) mocks[`../../../common/components/icons/${name}`] = { [name]: () => null };

    const { AboutModal } = loadWithMocks(new URL('../frontend/features/about/components/AboutModal.tsx', import.meta.url), mocks);
    const nodes = componentNodes(await harness.render(AboutModal, { isOpen: true, onClose() {} }));
    const display = JSON.stringify(nodes);
    assert.match(display, /Architecture/);
    assert.match(display, /amd64/);
    assert.doesNotMatch(display, /legacy-deadbeef|Git Commit|architectureCommit/);

    const copyDiagnostics = nodes.find((node) => node.type === 'button' && node.props.title === 'Copy system and version information');
    await copyDiagnostics.props.onClick();
    assert.match(copiedText, /Architecture: amd64/);
    assert.doesNotMatch(copiedText, /legacy-deadbeef|Git Commit/);
  } finally {
    harness.cleanup();
    globalThis.window = originalWindow;
    globalThis.setTimeout = originalTimeout;
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else delete globalThis.navigator;
  }
});
