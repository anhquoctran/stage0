import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';

const { getMentionQuery } = loadWithMocks(new URL('../frontend/common/utils/mentions.ts', import.meta.url), {});

test('MR and commit triggers recognize ID/hash prefixes and replace the complete token at the caret', () => {
  assert.deepEqual(getMentionQuery('See !mr-123 next', 10), { start: 4, end: 11, query: 'mr-12', trigger: '!' });
  assert.deepEqual(getMentionQuery('(#C419BA8)', 9), { start: 1, end: 9, query: 'c419ba8', trigger: '#' });
  assert.deepEqual(getMentionQuery('!123', 4), { start: 0, end: 4, query: '123', trigger: '!' });
  assert.equal(getMentionQuery('#', 1)?.trigger, '#');
  assert.equal(getMentionQuery('!', 1)?.trigger, '!');
  assert.equal(getMentionQuery(`#${'a'.repeat(64)}`, 65)?.query.length, 64);
});

test('reference triggers stay literal inside code, quotes, links, escapes, words and invalid hash tokens', () => {
  for (const value of ['`!mr-1', '```md\n#abcdef0', '> !mr-1', '    #abcdef0',
    '[label !mr-1', '[label](#abc', '\\!mr-1', '\\#abcdef0', 'word!mr-1', 'path/#abcdef0',
    '#heading', '#abc_xyz', '#abc-def', `#${'a'.repeat(65)}`, '# Heading']) {
    assert.equal(getMentionQuery(value, value.length), null, value);
  }
  assert.equal(getMentionQuery('`example` !mr-1', 15)?.query, 'mr-1');
  assert.deepEqual(getMentionQuery('Hello @Bot', 10), { start: 6, end: 10, query: 'bot' });
});

test('editor shortcuts isolate MR/commit results and persist immutable links without reviewer mentions', async (t) => {
  const hash = 'a'.repeat(40);
  const harness = componentHarness();
  const originalRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = (callback) => { callback(); return 0; };
  t.after(() => { globalThis.requestAnimationFrame = originalRaf; harness.cleanup(); });
  const { MarkdownEditor } = loadWithMocks(new URL('../frontend/common/components/MarkdownEditor.tsx', import.meta.url), {
    react: harness.react,
    './MarkdownPreview': { MarkdownPreview: 'Preview' },
    ...Object.fromEntries(['Bold', 'Italic', 'Heading', 'Code', 'SquareCode', 'Quote', 'List', 'ListOrdered', 'CheckSquare', 'Link', 'Eye', 'PenLine', 'Sparkles']
      .map((name) => [`./icons/${name}`, { [name]: name }])),
  });
  const { directReviewerMentions } = loadWithMocks(
    new URL('../frontend/features/review/utils/discussionReplyRecipients.ts', import.meta.url), {},
  );
  const options = [{ kind: 'mr', id: 'mr-id-1', label: 'MR · aaa title' },
    { kind: 'commit', id: hash, label: hash.slice(0, 8), description: 'mr commit' },
    { kind: 'reviewer', id: 'bot', label: 'mr aaa Bot' }];
  let value = '', nodes;
  const render = async () => { nodes = componentNodes(await harness.render(MarkdownEditor, {
    value, onChange: (next) => { value = next; }, mentionOptions: options,
  })); };
  const input = async (text) => {
    nodes.find((node) => node.type === 'textarea').props.onChange({ target: { value: text, selectionStart: text.length } });
    await render();
    return nodes.filter((node) => node.props?.role === 'option');
  };
  await render();
  let suggestions = await input('See !mr-id');
  assert.equal(suggestions.length, 1);
  suggestions[0].props.onClick();
  assert.ok(value.includes('](#mr-mention/mr/mr-id-1)'));
  assert.deepEqual(directReviewerMentions(value, ['bot', 'mr-id-1']), []);
  suggestions = await input('See #AAA');
  assert.equal(suggestions.length, 1);
  suggestions[0].props.onClick();
  assert.equal(value, `See [#aaaaaaaa](#mr-mention/commit/${hash}) `);
  assert.deepEqual(directReviewerMentions(value, ['bot', hash]), []);
  assert.equal((await input('#deadbeef')).length, 0);
  assert.equal(value, '#deadbeef');
  assert.equal((await input('!missing')).length, 0);
});
