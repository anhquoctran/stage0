import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';

function fixture(enabled = true, failure = false) {
  const harness = componentHarness();
  const calls = [];
  const changes = [];
  const status = { modelReady: false, installing: false, cacheBytes: 2048, modelBytes: 0, downloadBytes: 487724985 };
  const read = async () => { calls.push('status'); return status; };
  const install = async () => { calls.push('install'); if (failure) throw new Error('fixture'); return { ...status, modelReady: true }; };
  const clear = async () => { calls.push('clear'); return { ...status, cacheBytes: 0 }; };
  const { LocalReviewContextSettings } = loadWithMocks(new URL('../frontend/features/review/components/LocalReviewContextSettings.tsx', import.meta.url), {
    react: harness.react,
    '../../../core/services/runtime/useApplicationServices': { useApplicationServices: () => ({ reviews: { getReviewContextCache: read, installReviewContextModel: install, clearReviewContextCache: clear } }) },
    '../../preferences/components/SettingRow': { SettingRow: 'SettingRow' },
    '../../preferences/components/ZedSwitch': { ZedSwitch: 'ZedSwitch' },
  });
  const render = () => harness.render(LocalReviewContextSettings, { enabled, onChange: (next) => changes.push(next) });
  return { render, calls, changes };
}

test('local model download is explicit and the cache toggle stays in the Preferences draft', async () => {
  const f = fixture();
  const nodes = componentNodes(await f.render());
  const toggle = nodes.find((n) => n.type === 'ZedSwitch');
  assert.equal(toggle.props.checked, true);
  toggle.props.onChange(false);
  assert.deepEqual(f.changes, [false]);
  assert.equal(f.calls.includes('install'), false);
  const download = nodes.find((n) => n.type === 'button' && JSON.stringify(n.props.children).includes('Download local model'));
  assert.ok(download);
  await download.props.onClick();
  assert.equal(f.calls.filter((call) => call === 'install').length, 1);
});

test('disabled local cache does not offer a model download or clear action', async () => {
  const f = fixture(false);
  assert.equal(componentNodes(await f.render()).filter((n) => n.type === 'button').length, 0);
  assert.equal(f.calls.includes('install'), false);
});
