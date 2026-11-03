import createDOMPurify from 'dompurify';

/** DOMPurify enforces HTML safety; local hooks retain Stage0's link/attachment privacy policy. */

const ALLOWED_TAGS = new Set([
  'a', 'b', 'blockquote', 'br', 'code', 'dd', 'del', 'details', 'div', 'dl', 'dt',
  'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'kbd', 'li', 'ol',
  'p', 'pre', 's', 'samp', 'small', 'span', 'strike', 'strong', 'sub', 'summary',
  'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul', 'var'
]);

const ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'target', 'rel']),
  img: new Set(['src', 'alt', 'title', 'width', 'height', 'loading']),
  th: new Set(['align', 'colspan', 'rowspan']),
  td: new Set(['align', 'colspan', 'rowspan']),
  code: new Set(['class']),
  span: new Set(['class']),
  div: new Set(['class']),
  pre: new Set(['class']),
};

const SAFE_URL_PATTERN = /^(?:(?:https?|mailto):|\/|#)/i;
const SAFE_DATA_IMAGE_PATTERN = /^data:image\/(?:png|jpeg|jpg|gif|webp|svg\+xml);base64,/i;
const SAFE_ASSET_IMAGE_PATTERN = /^(?:asset:\/\/|https?:\/\/asset\.localhost\/)/i;

export function isSafeUrl(url: string, isImage = false): boolean {
  const trimmed = url.trim();
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return false;
  if (isImage) {
    // Markdown is user-controlled. Remote images create silent third-party
    // requests whenever a review/comment is opened, so only allow local paths
    // and supported data images in previews.
    if (SAFE_DATA_IMAGE_PATTERN.test(trimmed) || SAFE_ASSET_IMAGE_PATTERN.test(trimmed)) return true;
    if (trimmed.startsWith('//') || trimmed.startsWith('\\')) return false;
    if (trimmed.startsWith('/') && !trimmed.includes('\\')) return true;
    return !trimmed.includes(':') && !trimmed.includes('\\');
  }
  if (SAFE_URL_PATTERN.test(trimmed)) {
    if (trimmed.startsWith('/') && (trimmed.startsWith('//') || trimmed.includes('\\'))) {
      return false;
    }
    return true;
  }
  return false;
}

const purifiers = new WeakMap<Window, ReturnType<typeof createDOMPurify>>();

/** A non-DOM caller receives escaped text, never partially stripped HTML. */
function escapedText(value: string): string {
  const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return value.replace(/[&<>"']/g, (character) => entities[character]);
}

export function sanitizeHtml(rawHtml: string): string {
  if (!rawHtml || typeof rawHtml !== 'string') return '';
  if (typeof window === 'undefined' || !window.document?.createElement
    || typeof createDOMPurify !== 'function') return escapedText(rawHtml);
  try {
    let purifier = purifiers.get(window);
    if (!purifier) {
      purifier = createDOMPurify(window);
      purifier.addHook('uponSanitizeAttribute', (node, data) => {
        const tag = node.nodeName.toLowerCase();
        if (!ALLOWED_ATTRIBUTES[tag]?.has(data.attrName)
          || (data.attrName === 'href' && !isSafeUrl(data.attrValue))
          || (data.attrName === 'src' && !isSafeUrl(data.attrValue, true))) data.keepAttr = false;
      });
      purifier.addHook('afterSanitizeAttributes', (node) => {
        if (node.nodeName.toLowerCase() === 'a' && node.hasAttribute('href')) {
          node.setAttribute('target', '_blank');
          node.setAttribute('rel', 'noopener noreferrer');
        }
      });
      purifiers.set(window, purifier);
    }
    if (!purifier.isSupported) return escapedText(rawHtml);
    return purifier.sanitize(rawHtml, {
      ALLOWED_TAGS: [...ALLOWED_TAGS, '#text'],
      ALLOWED_ATTR: [...new Set(Object.values(ALLOWED_ATTRIBUTES).flatMap((attrs) => [...attrs]))],
      ALLOWED_NAMESPACES: ['http://www.w3.org/1999/xhtml'],
      // Retain native attachment URLs; the hook applies the stricter per-attribute privacy policy.
      ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|asset):|data:image\/(?:png|jpeg|jpg|gif|webp|svg\+xml);base64,|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
      ALLOW_ARIA_ATTR: false, ALLOW_DATA_ATTR: false, KEEP_CONTENT: false,
      RETURN_TRUSTED_TYPE: false,
    });
  } catch (error) {
    console.error('HTML sanitization failed:', error);
    return escapedText(rawHtml);
  }
}
