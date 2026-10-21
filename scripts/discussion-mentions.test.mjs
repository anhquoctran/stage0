import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';

const mentions = loadWithMocks(new URL('../frontend/common/utils/mentions.ts', import.meta.url), {});
const { getDiscussionMentionOptions } = loadWithMocks(new URL('../frontend/features/virtual-mr/utils/discussionMentions.ts', import.meta.url), {});
const session = {
  assignee: { name: 'Alice', email: 'alice@test' },
  reviewers: [{ agentId: 'security', agentName: 'Security Bot' }, { agentId: 'performance', agentName: 'Performance Bot' }],
};

test('assignee can mention assigned reviewers; AI reviewers can mention peers and assignee, excluding themselves', () => {
  assert.deepEqual(getDiscussionMentionOptions(session).map((item) => [item.kind, item.id]), [['reviewer', 'security'], ['reviewer', 'performance']]);
  assert.deepEqual(getDiscussionMentionOptions(session, 'ai_agent', 'security').map((item) => [item.kind, item.id]), [['assignee', 'alice@test'], ['reviewer', 'performance']]);
  assert.deepEqual(getDiscussionMentionOptions({ ...session, reviewers: [...session.reviewers, session.reviewers[0]] }).map((item) => item.id), ['security', 'performance']);
});

test('mentions retain stable identity with duplicate names, unicode, email and Markdown punctuation', () => {
  const option = { kind: 'assignee', id: 'alice+test@example.test', label: 'Alice [QA]' };
  const value = mentions.formatMention(option);
  assert.equal(value, '[@Alice \\[QA\\]](#mr-mention/assignee/alice%2Btest%40example.test)');
  assert.deepEqual(mentions.parseMentionReference('#mr-mention/assignee/alice%2Btest%40example.test'), { kind: option.kind, id: option.id });
  assert.equal(mentions.parseMentionReference('#mr-mention/reviewer/%broken'), null);
  assert.equal(mentions.parseMentionReference('https://example.test/#mr-mention/reviewer/security'), null);
  assert.notEqual(mentions.formatMention({ ...option, id: '1' }), mentions.formatMention({ ...option, id: '2' }));
});

test('autocomplete recognises caret edits and unicode, but excludes email, quotes, code and existing links', () => {
  assert.deepEqual(mentions.getMentionQuery('Hello @Sec rest', 10), { start: 6, end: 10, query: 'sec' });
  assert.deepEqual(mentions.getMentionQuery('@Security, hello', 4), { start: 0, end: 9, query: 'sec' });
  assert.equal(mentions.getMentionQuery('@Quốc', 5).query, 'quốc');
  for (const value of ['alice@test', '> @Security', '`@Security', '```md\n@Security', '~~~md\n@Security', '    @Security', '[@Security']) {
    assert.equal(mentions.getMentionQuery(value, value.length), null, value);
  }
  assert.equal(mentions.getMentionQuery('`code` @Sec', 11).query, 'sec');
});

async function editorFixture(t, initialValue = '') {
  const harness = componentHarness();
  let value = initialValue;
  let submits = 0;
  let isSubmitting = false;
  const originalRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = (callback) => { callback(); return 0; };
  t.after(() => { globalThis.requestAnimationFrame = originalRaf; });
  const { MarkdownEditor } = loadWithMocks(new URL('../frontend/common/components/MarkdownEditor.tsx', import.meta.url), {
    react: harness.react,
    './MarkdownPreview': { MarkdownPreview: 'Preview' },
    '../utils/shortcuts': { formatShortcutText: (value) => value },
    '../utils/mentions': mentions,
    ...Object.fromEntries(['Bold', 'Italic', 'Heading', 'Code', 'SquareCode', 'Quote', 'List', 'ListOrdered', 'CheckSquare', 'Link', 'Eye', 'PenLine', 'Sparkles']
      .map((name) => [`./icons/${name}`, { [name]: name }])),
  });
  let nodes;
  const render = async () => { nodes = componentNodes(await harness.render(MarkdownEditor, {
    value, onChange: (next) => { value = next; }, mentionOptions: getDiscussionMentionOptions(session),
    onSubmit: () => submits++, showActions: true, isSubmitting,
  })); };
  const textarea = () => nodes.find((node) => node.type === 'textarea');
  const options = () => nodes.filter((node) => node.props?.role === 'option');
  const input = async (next, caret = next.length) => {
    textarea().props.onChange({ target: { value: next, selectionStart: caret } });
    await render();
  };
  const key = async (key, extra = {}) => {
    let prevented = false;
    let stopped = false;
    textarea().props.onKeyDown({ key, ctrlKey: false, metaKey: false, shiftKey: false,
      preventDefault: () => { prevented = true; }, stopPropagation: () => { stopped = true; }, ...extra });
    await render();
    return { prevented, stopped };
  };
  await render();
  return { render, textarea, options, input, key, value: () => value, submits: () => submits, setSubmitting: (next) => { isSubmitting = next; } };
}

test('keyboard autocomplete inserts a stable mention without submitting and preserves surrounding content', async (t) => {
  const view = await editorFixture(t);
  await view.input('Hello @Sec, check this', 10);
  assert.equal(view.options().length, 1);
  await view.key('Enter');
  assert.equal(view.value(), 'Hello [@Security Bot](#mr-mention/reviewer/security), check this');
  assert.equal(view.submits(), 0);
  await view.key('Enter', { ctrlKey: true });
  assert.equal(view.submits(), 1);
});

test('arrow keys choose a reviewer and Escape closes only the suggestion list', async (t) => {
  const view = await editorFixture(t);
  await view.input('@');
  assert.equal(view.options().length, 2);
  await view.key('ArrowDown');
  assert.equal(view.options()[1].props['aria-selected'], true);
  await view.key('Tab');
  assert.equal(view.value(), '[@Performance Bot](#mr-mention/reviewer/performance) ');
  await view.input('@Sec');
  assert.deepEqual(await view.key('Escape'), { prevented: true, stopped: true });
  assert.equal(view.options().length, 0);
});

test('mouse selection inserts a mention and submissions in flight cannot be repeated by keyboard', async (t) => {
  const view = await editorFixture(t);
  await view.input('@Perf');
  view.options()[0].props.onClick();
  await view.render();
  assert.match(view.value(), /#mr-mention\/reviewer\/performance/);
  view.setSubmitting(true);
  await view.render();
  await view.key('Enter', { ctrlKey: true });
  assert.equal(view.submits(), 0);
  assert.equal(view.textarea().props.disabled, true);
});
