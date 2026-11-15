import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';

test('@ isolates people and bots even when MR titles, subjects and IDs match the query', async (t) => {
  const harness = componentHarness();
  const oldRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = callback => { callback(); return 0; };
  t.after(() => { globalThis.requestAnimationFrame = oldRaf; harness.cleanup(); });
  const { MarkdownEditor } = loadWithMocks(new URL('../frontend/common/components/MarkdownEditor.tsx', import.meta.url), {
    react: harness.react,
    './MarkdownPreview': { MarkdownPreview: 'Preview' },
  });
  let value = '', nodes;
  const options = [
    { kind: 'reviewer', id: 'bot', label: 'Shared reviewer' },
    { kind: 'assignee', id: 'person@test', label: 'Shared person' },
    { kind: 'mr', id: 'shared-mr', label: 'Shared MR' },
    { kind: 'commit', id: 'a'.repeat(40), label: 'Shared commit', description: 'Shared subject' },
  ];
  const render = async () => { nodes = componentNodes(await harness.render(MarkdownEditor, {
    value, onChange: next => { value = next; }, mentionOptions: options,
  })); };
  const type = async text => {
    nodes.find(n => n.type === 'textarea').props.onChange({ target: { value: text, selectionStart: text.length } });
    await render();
    return nodes.filter(n => n.props?.role === 'option');
  };
  await render();
  let suggestions = await type('@');
  assert.equal(suggestions.length, 2);
  suggestions = await type('@Shared');
  assert.equal(suggestions.length, 2);
  suggestions[0].props.onClick();
  assert.equal(value, '[@Shared reviewer](#mr-mention/reviewer/bot) ');
  suggestions = await type('@person');
  assert.equal(suggestions.length, 1);
  suggestions[0].props.onClick();
  assert.equal(value, '[@Shared person](#mr-mention/assignee/person%40test) ');
  assert.equal((await type('@aaaaaaa')).length, 0);
  assert.equal((await type('@shared-mr')).length, 0);
  assert.equal((await type('!shared-mr')).length, 1);
  assert.equal((await type('#aaaaaaa')).length, 1);
});
