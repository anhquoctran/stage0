import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';

test('mention insertion commits its caret before typing and never replays a delayed caret into review text', async t => {
  const frames = [], previous = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
  t.after(() => { globalThis.requestAnimationFrame = previous; });
  const harness = componentHarness();
  const { MarkdownEditor } = loadWithMocks(new URL('../frontend/common/components/MarkdownEditor.tsx', import.meta.url), {
    react: harness.react, './MarkdownPreview': { MarkdownPreview: 'Preview' },
  });
  let value = '@One rest', textarea;
  const dom = { value, selectionStart: 4, selectionEnd: 4, focus() {},
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; } };
  const render = async () => {
    const nodes = componentNodes(await harness.render(MarkdownEditor, { value, onChange: next => { value = next; },
      mentionOptions: [{ id: 'one', label: 'One', kind: 'reviewer' }] }));
    textarea = nodes.find(n => n.type === 'textarea');
    if (dom.value !== value) { dom.value = value; dom.selectionStart = dom.selectionEnd = value.length; }
    const ref = textarea.props.ref;
    if (typeof ref === 'function') ref(dom); else ref.current = dom;
  };
  await render(); textarea.props.onFocus({ currentTarget: dom }); await render();
  textarea.props.onKeyDown({ key: 'Enter', ctrlKey: false, metaKey: false, shiftKey: false, preventDefault() {} });
  await render();
  const mention = '[@One](#mr-mention/reviewer/one)';
  assert.equal(value, `${mention} rest`);
  assert.equal(dom.selectionStart, mention.length, 'Insertion must not wait for a future frame');
  const next = `${mention} rrest`, caret = mention.length + 2;
  dom.value = next; dom.setSelectionRange(caret, caret);
  textarea.props.onChange({ target: dom }); await render();
  for (const frame of frames) frame(0);
  assert.equal(value, next); assert.equal(dom.selectionStart, caret); assert.equal(dom.selectionEnd, caret);
});
