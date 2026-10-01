/**
 * Pure DOM-based HTML Sanitizer for Webview environment.
 * Zero external dependencies, eliminates XSS vectors from untrusted Markdown inputs.
 */

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
const SAFE_DATA_IMAGE_PATTERN = /^data:image\/(?:png|jpeg|gif|webp|svg\+xml);base64,/i;

function isSafeUrl(url: string, isImage = false): boolean {
  const trimmed = url.trim();
  if (SAFE_URL_PATTERN.test(trimmed)) {
    return true;
  }
  if (isImage && SAFE_DATA_IMAGE_PATTERN.test(trimmed)) {
    return true;
  }
  return false;
}

function sanitizeNode(node: Node, doc: Document): void {
  const children = Array.from(node.childNodes);
  for (const child of children) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const element = child as HTMLElement;
      const tagName = element.tagName.toLowerCase();

      // Drop disallowed tags entirely
      if (!ALLOWED_TAGS.has(tagName)) {
        element.remove();
        continue;
      }

      // Sanitize attributes
      const allowedAttrsForTag = ALLOWED_ATTRIBUTES[tagName] || new Set(['class', 'title']);
      const attrNames = element.getAttributeNames();

      for (const attr of attrNames) {
        const lowerAttr = attr.toLowerCase();

        // Strictly reject event handlers (onclick, onerror, onload, etc.)
        if (lowerAttr.startsWith('on')) {
          element.removeAttribute(attr);
          continue;
        }

        // Check if attribute is whitelisted for this tag
        if (!allowedAttrsForTag.has(lowerAttr)) {
          element.removeAttribute(attr);
          continue;
        }

        // Validate URLs in href and src
        const attrVal = element.getAttribute(attr) || '';
        if (lowerAttr === 'href') {
          if (!isSafeUrl(attrVal, false)) {
            element.removeAttribute(attr);
          } else {
            // Force noopener noreferrer for target=_blank
            element.setAttribute('target', '_blank');
            element.setAttribute('rel', 'noopener noreferrer');
          }
        } else if (lowerAttr === 'src') {
          if (!isSafeUrl(attrVal, true)) {
            element.removeAttribute(attr);
          }
        }
      }

      // Recurse into valid child elements
      sanitizeNode(element, doc);
    } else if (child.nodeType === Node.COMMENT_NODE) {
      // Remove comments to prevent conditional parsing exploits
      child.remove();
    }
  }
}

export function sanitizeHtml(rawHtml: string): string {
  if (!rawHtml || typeof rawHtml !== 'string') {
    return '';
  }

  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    // Fallback: strip tags via regex if outside browser
    return rawHtml.replace(/<[^>]*>/g, '');
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');
    sanitizeNode(doc.body, doc);
    return doc.body.innerHTML;
  } catch (err) {
    console.error('HTML Sanitization error:', err);
    return '';
  }
}
