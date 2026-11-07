import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';

test('one compact custom encoding selector lists all codecs and Automatic resets the file', async () => {
  const harness = componentHarness();
  const { FileEncodingPicker } = loadWithMocks(new URL('../frontend/features/git/components/diff-viewer/FileEncodingPicker.tsx', import.meta.url), {
    react: harness.react,
    '../../../../common/components/CustomSelect': { CustomSelect: 'CustomSelect' },
  });
  const changes = [];
  const nodes = componentNodes(await harness.render(FileEncodingPicker, {
    encoding: 'Windows-1251', onChange: encoding => changes.push(encoding),
  }));
  const select = nodes.find(node => node.type === 'CustomSelect');
  assert.ok(select);
  assert.equal(nodes.some(node => node.type === 'select'), false);
  assert.equal(select.props.value, 'Windows-1251');
  assert.equal(select.props.options.length, 41);
  assert.equal(select.props.options[0].value, '');
  assert.equal(select.props.portal, true);
  assert.equal(select.props.dropdownPlacement, 'auto');
  select.props.onChange('UTF-16 BE');
  select.props.onChange('');
  assert.deepEqual(changes, ['UTF-16 BE', null]);
  harness.cleanup();
});

test('manual decoding ignores stale file/encoding responses and keeps preferences per repository and path', async () => {
  const harness = componentHarness();
  const requests = [];
  const selections = {};
  const store = {
    selections,
    setEncoding: (key, encoding) => { selections[key] = encoding; },
  };
  const services = { gitFiles: { getFileTextDiff: input => new Promise((resolve, reject) => requests.push({ input, resolve, reject })) } };
  const { useFileDiffEncoding } = loadWithMocks(new URL('../frontend/features/git/hooks/useFileDiffEncoding.ts', import.meta.url), {
    react: harness.react,
    '../../../core/services/runtime/useApplicationServices': { useApplicationServices: () => services },
    '../store/useFileEncodingStore': { useFileEncodingStore: selector => selector(store) },
  });
  let file = 'one.txt', repo = '/repo-a';
  const render = () => harness.render(() => useFileDiffEncoding(repo, 'base-sha', 'head-sha', file));
  try {
    let state = await render();
    assert.equal(requests.length, 0);
    state.setEncoding('Windows-1251');
    state = await render();
    assert.equal(state.loading, true);
    state.setEncoding('UTF-8');
    await render();
    requests[1].resolve({ raw_diff: 'latest', old_encoding: 'Windows-1251', new_encoding: 'UTF-8' });
    state = await render();
    assert.equal(state.data.raw_diff, 'latest');
    requests[0].resolve({ raw_diff: 'stale' });
    assert.equal((await render()).data.raw_diff, 'latest');
    file = 'two.txt';
    assert.equal((await render()).manual, false);
    file = 'one.txt';
    assert.equal((await render()).encoding, 'UTF-8');
    repo = '/repo-b';
    assert.equal((await render()).manual, false);
    repo = '/repo-a';
    state = await render();
    state.setEncoding(null);
    state = await render();
    assert.equal(state.manual, false);
    assert.equal(state.data, null);
  } finally { harness.cleanup(); }
});
