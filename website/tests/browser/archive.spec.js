import { test, expect, open, release, names, digest } from './fixtures.js';

const cards = (page) => page.locator('.release-history-card');
const tags = (page) => page.locator('.release-history-card h3');
const pageNumber = (page) => page.locator('#release-history-page-label [aria-current="page"]');

test('release history loads automatically and filters artifacts by operating system and architecture', async ({
  page,
}) => {
  const catalog = [names[8], names[7], names[6], names[5], names[2], names[0]].map((name, i) =>
    release(`v1.0.${i}`, [name]),
  );
  const requests = await open(page, catalog);
  await expect(cards(page)).toHaveCount(6);
  expect(requests).toHaveLength(1);
  await page.locator('[data-history-os="linux"]').click();
  await expect(page.locator('[data-history-os="linux"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(cards(page)).toHaveCount(2);
  await page.locator('[data-history-arch="arm64"]').click();
  await expect(cards(page)).toHaveCount(1);
  const row = page.locator('.release-history-asset-row');
  expect(await row.getAttribute('href')).toBeNull();
  await expect(page.locator('.release-history-platform h4')).toHaveText('Linux');
  await expect(page.locator('.release-history-asset-logo')).toHaveClass(
    'fa-brands fa-linux release-history-asset-logo',
  );
  await expect(page.locator('.release-history-asset-arch')).toHaveText('ARM64');
  await expect(page.locator('.release-history-asset-format')).toHaveText('DEB');
  await expect(page.locator('.release-history-asset-size')).toHaveText('10 MB');
  await expect(page.locator('.release-history-asset-digest span')).toHaveText('SHA-256');
  await expect(page.locator('.release-history-asset-digest code')).toHaveText(
    `${digest.slice(0, 6)}…${digest.slice(-6)}`,
  );
  await expect(page.locator('.release-history-asset-digest')).toHaveAttribute(
    'title',
    `Copy SHA-256 digest ${digest}`,
  );
  await page.locator('.release-history-asset-digest').click();
  expect(await page.evaluate(() => window.clipboardWrites)).toEqual([digest]);
  await expect(page.locator('.release-history-download-button')).toHaveAttribute(
    'href',
    /Stage0_arm64\.deb$/,
  );
  await expect(page.locator('.release-history-download-button')).toHaveText('Download');
});

test('release assets sort by OS, architecture, and uppercase extension label', async ({ page }) => {
  await open(page, [release('v1.0.7', [...names].reverse())]);
  await expect(page.locator('.release-history-platform h4')).toHaveText([
    'Linux',
    'macOS',
    'Windows',
  ]);
  const groups = page.locator('.release-history-platform');
  for (const [i, count] of [5, 2, 2].entries())
    await expect(groups.nth(i).locator('li')).toHaveCount(count);
  expect(
    await page.locator('.release-history-asset-details').evaluateAll((rows) =>
      rows.map((row) =>
        [...row.children]
          .slice(0, 2)
          .map((el) => el.textContent)
          .join(' '),
      ),
    ),
  ).toEqual([
    'ARM64 DEB',
    'ARM64 RPM',
    'AMD64 APPIMAGE',
    'AMD64 DEB',
    'AMD64 RPM',
    'ARM64 DMG',
    'AMD64 DMG',
    'ARM64 EXE',
    'AMD64 EXE',
  ]);
});

test('release history paginates loaded results, then fetches the next GitHub page on demand', async ({
  page,
}) => {
  const first = Array.from({ length: 100 }, (_, i) => release(`v1.0.${i}`, [names[7]]));
  const requests = await open(page, (url) =>
    url.searchParams.get('page') === '2' ? [release('v1.0.101', [names[8]])] : first,
  );
  await expect(cards(page)).toHaveCount(10);
  await expect(page.locator('#release-history-next')).toBeEnabled();
  await page.locator('#release-history-next').click();
  await expect(pageNumber(page)).toHaveText('2');
  await expect(cards(page)).toHaveCount(10);
  await page.locator('[data-history-arch="x64"]').click();
  await expect(pageNumber(page)).toHaveText('1');
  await expect(cards(page)).toHaveCount(0);
  await expect(page.locator('#release-history-load-more')).toBeVisible();
  expect(requests).toHaveLength(1);
  await page.locator('#release-history-load-more').click();
  await expect(cards(page)).toHaveCount(1);
  await expect(tags(page)).toHaveText('v1.0.101');
  expect(requests).toHaveLength(2);
  expect(requests[0]).toMatch(/[?&]page=1/);
  expect(requests[1]).toMatch(/[?&]page=2/);
});

test('Stable only defaults on; toggling preserves OS and architecture filters without fetching again', async ({
  page,
}) => {
  const requests = await open(page, [
    release('v1.0.4-nightly'),
    release('v1.0.3-beta'),
    release('v1.0.2'),
    release('v1.0.1', [names[8]]),
  ]);
  const toggle = page.locator('#release-history-stable-only');
  await expect(toggle).toBeChecked();
  await expect(tags(page)).toHaveText(['v1.0.2', 'v1.0.1']);
  await page.locator('[data-history-os="linux"]').click();
  await page.locator('[data-history-arch="arm64"]').click();
  await expect(tags(page)).toHaveText(['v1.0.2']);
  await toggle.uncheck();
  await expect(tags(page)).toHaveText(['v1.0.4-nightly', 'v1.0.3-beta', 'v1.0.2']);
  await toggle.check();
  await expect(tags(page)).toHaveText(['v1.0.2']);
  expect(requests).toHaveLength(1);
});

test('changing Stable only resets pagination and keeps stable releases available on older API pages', async ({
  page,
}) => {
  const first = Array.from({ length: 100 }, (_, i) => release(`v1.0.${i}-nightly`, [names[8]]));
  const requests = await open(page, (url) =>
    url.searchParams.get('page') === '2' ? [release('v1.0.101', [names[8]])] : first,
  );
  await expect(cards(page)).toHaveCount(0);
  await expect(page.locator('#release-history-load-more')).toBeVisible();
  await page.locator('#release-history-load-more').click();
  await expect(cards(page)).toHaveCount(1);
  await page.locator('#release-history-stable-only').uncheck();
  await page.locator('#release-history-next').click();
  await expect(pageNumber(page)).toHaveText('2');
  await page.locator('#release-history-stable-only').check();
  await expect(pageNumber(page)).toHaveText('1');
  await expect(cards(page)).toHaveCount(1);
  await expect(tags(page)).toHaveText('v1.0.101');
  expect(requests).toHaveLength(2);
});

test('numbered pagination stays bounded, supports direct jumps and marks the current page', async ({
  page,
}) => {
  const requests = await open(
    page,
    Array.from({ length: 100 }, (_, i) => release(`v1.0.${i}`, [names[8]])),
  );
  await expect(pageNumber(page)).toHaveText('1');
  expect(await page.locator('#release-history-page-label > *').count()).toBeLessThanOrEqual(7);
  await expect(page.locator('.release-history-page-gap')).toHaveText('…');
  await page.getByRole('button', { name: 'Go to page 10', exact: true }).click();
  await expect(pageNumber(page)).toHaveText('10');
  await expect(page.locator('#release-history-next')).toBeDisabled();
  expect(await page.locator('#release-history-page-label > *').count()).toBeLessThanOrEqual(7);
  await page.getByRole('button', { name: 'Go to page 9', exact: true }).click();
  await expect(pageNumber(page)).toHaveText('9');
  await expect(page.locator('#release-history-next')).toBeEnabled();
  expect(requests).toHaveLength(1);
});

test('API failures display retry, recover and do not poison the release cache', async ({
  page,
}) => {
  let fail = true;
  await page.route('https://api.github.com/repos/anhquoctran/stage0/releases**', (route) =>
    route.fulfill(fail ? { status: 429, json: {} } : { json: [release()] }),
  );
  await page.goto('./');
  await expect(page.locator('#release-channel-status')).toContainText('rate limit');
  expect(await page.evaluate(() => localStorage.getItem('stage0_release_history_v3'))).toBeNull();
  fail = false;
  await page.locator('#release-history-retry').click();
  await expect(cards(page)).toHaveCount(1);
  await expect(page.locator('#release-channel-status')).toContainText('v1.0.2');
  await page.reload();
  await expect(cards(page)).toHaveCount(1);
});
