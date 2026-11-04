import { parseFragment } from 'parse5';

/** Project translation markup to React text children; never return HTML for a DOM sink. */
export function translationText(value) {
  const text = (node) => node.nodeName === '#text' ? node.value
    : (node.childNodes ?? []).map(text).join('');
  return text(parseFragment(value));
}
