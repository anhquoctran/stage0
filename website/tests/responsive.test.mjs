import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const mockupStyles = readFileSync(new URL('../mockup.css', import.meta.url), 'utf8');
const page = readFileSync(new URL('../../dist/website/index.html', import.meta.url), 'utf8');

function mediaRules(maxWidth) {
  const marker = `@media (max-width: ${maxWidth}) {`;
  const blocks = [];
  let start = styles.indexOf(marker);
  assert.notEqual(start, -1, `expected responsive breakpoint at ${maxWidth}`);
  while (start !== -1) {
    let depth = 1;
    let end = start + marker.length;
    for (; depth && end < styles.length; end++) {
      if (styles[end] === '{') depth++;
      if (styles[end] === '}') depth--;
    }
    assert.equal(depth, 0, `expected closing brace for breakpoint at ${maxWidth}`);
    blocks.push(styles.slice(start + marker.length, end - 1));
    start = styles.indexOf(marker, end);
  }
  return blocks.join('\n');
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
  assert.match(
    styles,
    /\.btn-pill-download\.download-recommended,\s*\.btn-format\.download-recommended/,
  );
});

test('hero uses left-aligned Fira Code typing over a partial grid background', () => {
  const hero = styles.match(/^\.hero\s*\{([^}]*)\}/m)?.[1] ?? '';
  const heroTitle = styles.match(/^\.hero-title\s*\{([^}]*)\}/m)?.[1] ?? '';
  const heroMarkup = page.match(/<section class="hero">[\s\S]*?<\/section>/)?.[0] ?? '';
  const headerMarkup = page.match(/<header class="header">[\s\S]*?<\/header>/)?.[0] ?? '';
  const desktopHeroLayout = styles.match(/^\.hero-layout\s*\{([^}]*)\}/m)?.[1] ?? '';
  const tabletHeroLayout = mediaRules('1200px').match(/\.hero-layout\s*\{([^}]*)\}/)?.[1] ?? '';
  const tabletHeroTitle = mediaRules('1024px').match(/\.hero-title\s*\{([^}]*)\}/)?.[1] ?? '';
  const compactTabletRules = mediaRules('860px');

  assert.match(hero, /text-align:\s*start/);
  assert.match(heroMarkup, /class="container-fluid"/);
  assert.match(headerMarkup, /class="container-fluid nav-row"/);
  assert.match(heroMarkup, /class="hero-copy"[\s\S]*?class="hero-visual"/);
  assert.match(
    desktopHeroLayout,
    /grid-template-columns:\s*minmax\(0,\s*0\.8fr\)\s+minmax\(0,\s*1\.2fr\)/,
  );
  assert.match(styles, /\.hero-visual \.mockup-wrapper\s*\{[^}]*margin-inline-end:\s*0/);
  assert.match(styles, /\.hero-copy\s*\{[^}]*align-self:\s*start;[^}]*margin-top:\s*1\.5rem/);
  assert.match(tabletHeroLayout, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(tabletHeroTitle, /font-size:\s*clamp\(2\.1rem,\s*4\.3vw,\s*2\.75rem\)/);
  assert.doesNotMatch(compactTabletRules, /\.hero-visual[\s\S]*?display:\s*none/);
  assert.match(
    styles,
    /@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\.hero-visual,[\s\S]*?\.mockup-wrapper\s*\{\s*display:\s*none !important/,
  );
  assert.doesNotMatch(mockupStyles, /@media\s*\(max-width:\s*860px\)/);
  assert.match(
    mockupStyles,
    /@media\s*\(max-width:\s*640px\)[\s\S]*?\.mockup-wrapper\s*\{\s*display:\s*none !important/,
  );
  assert.match(mockupStyles, /\.mockup-wrapper\s*\{[^}]*container:\s*stage0-mockup \/ inline-size/);
  assert.match(
    mockupStyles,
    /grid-template-columns:\s*clamp\(180px,\s*26%,\s*260px\)\s+minmax\(0,\s*1fr\)/,
  );
  assert.match(
    mockupStyles,
    /@container stage0-mockup\s*\(max-width:\s*900px\)[\s\S]*?\.mockup-titlebar-center,[\s\S]*?\.mockup-tabbar-left,[\s\S]*?display:\s*none !important/,
  );
  assert.match(mockupStyles, /\.ai-review-card\s*\{[^}]*background-color:\s*var\(--ctp-mantle\)/);
  assert.match(
    mockupStyles,
    /\.suggested-patch-code\s*\{[^}]*white-space:\s*pre-wrap;[^}]*overflow-wrap:\s*anywhere/,
  );
  assert.match(mockupStyles, /\.suggested-patch-code code\s*\{[^}]*white-space:\s*inherit/);
  assert.match(
    mockupStyles,
    /\[data-theme="latte"\] \.ai-bot-name,[\s\S]*?color:\s*var\(--ctp-text\)/,
  );
  assert.match(
    mockupStyles,
    /@container stage0-mockup\s*\(max-width:\s*900px\)[\s\S]*?\.diff-line\s*\{[^}]*min-width:\s*0/,
  );
  assert.match(
    mockupStyles,
    /\.diff-code\s*\{[^}]*white-space:\s*pre-wrap;[^}]*overflow-wrap:\s*anywhere/,
  );
  assert.match(styles, /\.hero::before\s*\{[\s\S]*?mask-image:\s*radial-gradient/);
  assert.match(
    styles,
    /\[data-theme="latte"\] \.hero::before,[\s\S]*?background-image:[\s\S]*?rgba\(100, 116, 139, 0\.18\)[\s\S]*?opacity:\s*0\.65/,
  );
  assert.doesNotMatch(styles, /url\('\.\/assets\/page-bg(?:-light)?\.svg'\)/);
  assert.match(heroTitle, /font-family:\s*'Fira Code'/);
  assert.match(styles, /\.hero-typing-line:first-child\s*\{[\s\S]*?animation:\s*hero-type-first/);
  assert.match(styles, /\.hero-typing-accent::after\s*\{[\s\S]*?animation:\s*hero-caret-blink/);
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(styles, /\.hero-stats\s*\{[\s\S]*?justify-content:\s*flex-start/);
  assert.match(page, /class="hero-typing-line"\s*>Autonomous AI Code Review\./);
  assert.match(
    page,
    /class="hero-typing-line hero-typing-accent text-highlight"\s*>Before You Push\./,
  );
});

test('release archive uses grouped platforms and a labelled numeric pagination region', () => {
  const archive = page.match(/<section id="release-history"[\s\S]*?<\/section>/)?.[0] ?? '';
  for (const value of ['windows', 'macos', 'linux'])
    assert.ok(archive.includes(`data-history-os="${value}"`));
  assert.match(
    archive,
    /<nav class="release-history-pagination" aria-label="Release history pages">/,
  );
  assert.match(archive, /aria-label="Previous page"/);
  assert.match(archive, /aria-label="Next page"/);
  assert.doesNotMatch(archive, />Page 1</);
  assert.match(styles, /\.release-history-platforms\s*\{[^}]*minmax\(min\(100%, 18rem\), 1fr\)/);
  assert.doesNotMatch(styles, /\.release-history-asset-row:hover/);
});

test('unselected download cards contrast with the light page background', () => {
  assert.match(
    styles,
    /\[data-theme="latte"\] \.download-card:not\(\.highlight\),\s*\[data-theme="light"\] \.download-card:not\(\.highlight\)\s*\{\s*background-color:\s*var\(--ctp-base\)/,
  );
  assert.match(
    styles,
    /\.download-card\.highlight\s*\{[^}]*background-color:\s*var\(--bg-elevated\)/,
  );
});
