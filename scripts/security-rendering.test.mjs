import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { marked } from 'marked';
import { loadWithMocks } from './helpers/componentHarness.mjs';
const createDOMPurify = createRequire(import.meta.url)('dompurify');
const source = new URL('../frontend/common/utils/sanitizeHtml.ts', import.meta.url);

function sanitizer(t) {
  const original = globalThis.window;
  const dom = new JSDOM('', { url: 'https://stage0.test/' });
  globalThis.window = dom.window;
  t.after(() => { globalThis.window = original; dom.window.close(); });
  return { ...loadWithMocks(source, { dompurify: { default: createDOMPurify } }), dom };
}

test('Markdown HTML removes active/mutation content, handlers, clobbering and javascript URLs', (t) => {
  const { sanitizeHtml, dom } = sanitizer(t);
  for (const raw of [
    '<img src=x onerror=alert(1)><script>alert(2)</script>',
    '<svg><g/onload=alert(1)//<p>',
    '<math><mtext><table><mglyph><style><!--</style><img title="--><img src=x onerror=alert(1)>">',
    '<a href="jav&#x61;script:alert(1)">bad</a><iframe srcdoc="<script>alert(2)</script>"></iframe>',
    '<a href="vbscript:msgbox(1)">bad</a><a href="data:text/html,unsafe">bad</a>',
    '<form id=attributes><input name=__proto__></form><div style="color:red" onclick="alert(1)">text</div>',
    '<svg><foreignObject><p onclick="alert(1)">bad</p></foreignObject></svg>',
  ]) {
    const document = new dom.window.DOMParser().parseFromString(sanitizeHtml(raw), 'text/html');
    assert.equal(document.querySelector('script,svg,math,iframe,form,input,style'), null, raw);
    assert.equal(document.querySelector('[onerror],[onclick],[onload],[style],[id],[name]'), null, raw);
    for (const anchor of document.querySelectorAll('a[href]')) {
      const protocol = new URL(anchor.getAttribute('href'), 'https://stage0.test/').protocol;
      assert.ok(['https:', 'http:', 'mailto:'].includes(protocol), raw);
    }
  }
  for (const href of ['javascript:alert(1)', 'vbscript:msgbox(1)', 'data:text/html,unsafe']) {
    const doc = new dom.window.DOMParser().parseFromString(sanitizeHtml(`<a href="${href}">bad</a>`), 'text/html');
    assert.equal(doc.querySelector('a').hasAttribute('href'), false, href);
  }
});

test('sanitized Markdown retains formatting, internal references and local attachments while blocking trackers', (t) => {
  const { sanitizeHtml, dom, isSafeUrl } = sanitizer(t);
  const result = sanitizeHtml('<p><strong>Review</strong> <a href="#mr-comment/c1">reference</a></p>'
    + '<pre><code class="language-rust">fn main() {}</code></pre>'
    + '<img src="asset://localhost/review.png" alt="local"><img src="https://evil.test/tracker.png">'
    + '<img src="/&#9;/evil.test/tracker.png"><img src="data:image/png;base64,aGVsbG8=">');
  const doc = new dom.window.DOMParser().parseFromString(result, 'text/html');
  assert.equal(doc.querySelector('strong').textContent, 'Review');
  assert.equal(doc.querySelector('code').className, 'language-rust');
  const anchor = doc.querySelector('a');
  assert.equal(anchor.getAttribute('href'), '#mr-comment/c1');
  assert.equal(anchor.getAttribute('rel'), 'noopener noreferrer');
  assert.equal(anchor.getAttribute('target'), '_blank');
  assert.equal(doc.querySelector('img[alt=local]').getAttribute('src'), 'asset://localhost/review.png');
  assert.deepEqual([...doc.querySelectorAll('img[src]')].map((image) => image.getAttribute('src')),
    ['asset://localhost/review.png', 'data:image/png;base64,aGVsbG8=']);
  for (const url of ['/\t/evil.test/tracker.png', 'java\nscript:alert(1)', '//evil.test/a', '/\\evil.test/a']) {
    assert.equal(isSafeUrl(url, true), false, url);
  }
});

test('non-DOM rendering escapes malformed tags instead of turning partial tag removal into executable HTML', (t) => {
  const original = globalThis.window;
  delete globalThis.window;
  t.after(() => { globalThis.window = original; });
  const { sanitizeHtml } = loadWithMocks(source, { dompurify: { default: createDOMPurify } });
  const raw = '<scr<script>ipt>alert("unsafe")</scr</script>ipt>&';
  const clean = sanitizeHtml(raw);
  assert.ok(!clean.includes('<'));
  assert.ok(clean.includes('&lt;scr&lt;script&gt;ipt&gt;'));
  const doc = new JSDOM(clean);
  assert.equal(doc.window.document.body.textContent, raw);
  doc.window.close();
});

test('untrusted finding locations cannot escape literal Markdown link labels with backticks, slashes or brackets', () => {
  const { escapeMarkdownText } = loadWithMocks(new URL('../frontend/common/utils/escapeMarkdownText.ts', import.meta.url), {});
  for (const location of ['src/cart.ts:28', 'src/`file`\\name.ts:1', 'x``](https://evil.test)![x](https://tracker.test):1', '<img src=x onerror=alert(1)>:5']) {
    const rendered = marked.parse(`- [${escapeMarkdownText(location)}](#mr-discussion/safe-id)`);
    const dom = new JSDOM(rendered);
    const anchors = dom.window.document.querySelectorAll('a');
    assert.equal(anchors.length, 1, location);
    assert.equal(anchors[0].getAttribute('href'), '#mr-discussion/safe-id');
    assert.equal(anchors[0].textContent, location);
    assert.equal(dom.window.document.querySelector('img,script'), null);
    dom.window.close();
  }
});
