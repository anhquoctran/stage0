import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { translationText } from './helpers/translationText.mjs';

test('the Trans fixture preserves text, nesting and decoded entities without regex tag rewriting', () => {
  assert.equal(translationText('<strong>Main &amp; beta</strong> <code>branch</code>'), 'Main & beta branch');
  assert.equal(translationText('<strong><em>Nested</em></strong> text'), 'Nested text');
});

test('malformed markup and entity-encoded tags remain text when projected through React', () => {
  for (const input of ['<scr<script>ipt>probe</scr</script>ipt>',
    '&lt;script&gt;probe&lt;/script&gt;', '<img src=x onerror=alert(1)>safe',
    '<svg><foreignObject><p>safe</p></foreignObject></svg>']) {
    const text = translationText(input);
    const output = renderToStaticMarkup(React.createElement('span', null, text));
    const dom = new JSDOM(output);
    assert.equal(dom.window.document.querySelector('script,img,svg,iframe'), null);
    assert.equal(dom.window.document.querySelector('span').textContent, text);
    dom.window.close();
  }
});
