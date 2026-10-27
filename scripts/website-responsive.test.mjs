import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const styles = readFileSync(new URL('../website/styles.css', import.meta.url), 'utf8');

function mediaRules(maxWidth) {
  const marker = `@media (max-width: ${maxWidth}) {`;
  const start = styles.lastIndexOf(marker);
  assert.notEqual(start, -1, `expected responsive breakpoint at ${maxWidth}`);
  const end = styles.indexOf('\n}', start);
  assert.notEqual(end, -1, `expected closing brace for breakpoint at ${maxWidth}`);
  return styles.slice(start + marker.length, end);
}

test('feature cards and download actions keep consistent responsive sizing', () => {
  const tabletGrid = mediaRules('1024px').match(/\.feature-grid\s*\{([^}]*)\}/)?.[1];
  const tabletDownloads = mediaRules('1024px').match(/\.download-grid\s*\{([^}]*)\}/)?.[1];
  const mobileGrid = mediaRules('640px').match(/\.feature-grid\s*\{([^}]*)\}/)?.[1];
  const primaryDownload = styles.match(/^\.btn-pill-download\s*\{([^}]*)\}/m)?.[1];
  const formatDownload = styles.match(/^\.btn-format\s*\{([^}]*)\}/m)?.[1];

  assert.match(tabletGrid ?? '', /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(tabletDownloads ?? '', /grid-template-columns:\s*1fr/);
  assert.match(tabletDownloads ?? '', /width:\s*100%/);
  assert.match(tabletDownloads ?? '', /max-width:\s*none/);
  assert.match(mobileGrid ?? '', /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(styles.match(/\.feature-card\s*\{([^}]*)\}/)?.[1] ?? '', /min-width:\s*0/);
  assert.match(primaryDownload ?? '', /min-height:\s*3rem/);
  assert.match(formatDownload ?? '', /min-height:\s*3rem/);
  assert.match(formatDownload ?? '', /width:\s*100%/);
  assert.match(styles, /\.btn-pill-download\.download-recommended,\s*\.btn-format\.download-recommended/);
});
