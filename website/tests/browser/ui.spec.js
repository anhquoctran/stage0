import { test, expect, open, release } from './fixtures.js';

test('theme persistence, mobile drawer, FAQ, distro and comparison filters', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await open(page);
  const before = await page.locator('html').getAttribute('data-theme');
  await page.getByRole('button', { name: 'Toggle theme', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute(
    'data-theme',
    before === 'latte' ? 'mocha' : 'latte',
  );
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute(
    'data-theme',
    before === 'latte' ? 'mocha' : 'latte',
  );
  await page.getByRole('button', { name: 'Toggle menu', exact: true }).click();
  await expect(page.locator('#mobile-menu')).toHaveClass(/open/);
  await page.locator('#mobile-menu a[href="#faq"]').click();
  await expect(page.locator('#mobile-menu')).not.toHaveClass(/open/);
  await page.locator('.faq-question').first().click();
  await expect(page.locator('.faq-item.open')).toHaveCount(1);
  await page.locator('.faq-question').nth(1).click();
  await expect(page.locator('.faq-item').first()).not.toHaveClass(/open/);
  await expect(page.locator('.faq-question').nth(1)).toHaveAttribute('aria-expanded', 'true');
  await page.locator('[data-distro-tab="deb"]').click();
  await expect(page.locator('[data-distro-code="deb"]')).toBeVisible();
  await expect(page.locator('[data-distro-code="appimage"]')).toBeHidden();
  await page.locator('[data-distro-code="deb"] button').click();
  expect(await page.evaluate(() => window.clipboardWrites.at(-1))).toContain('sudo dpkg -i');
  await page.locator('[data-comp-filter="pr"]').click();
  await expect(page.locator('[data-comp-target="ai"]').first()).toBeHidden();
  await expect(page.locator('[data-comp-target="pr"]').first()).toBeVisible();
});

test('desktop mockup switches views/files and responds to patch, refresh and copy', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page);
  await page.locator('[data-mockup-tab="ai"]').click();
  await expect(page.locator('#mockup-view-ai')).toBeVisible();
  await expect(page.locator('#mockup-view-diff')).toBeHidden();
  await page.locator('[data-file-key="vault"]').click();
  await expect(page.locator('#mockup-view-diff')).toBeVisible();
  await expect(page.locator('#mockup-file-name-display')).toHaveText('token_vault.rs');
  await expect(page.locator('.diff-lines-container')).toContainText('TokenVault');
  await expect(page.locator('.ai-review-card')).toBeHidden();
  await page.locator('.btn-crumb-copy').click();
  expect(await page.evaluate(() => window.clipboardWrites.at(-1))).toBe(
    'src/security/token_vault.rs',
  );
  await page.locator('[data-file-key="db"]').click();
  await expect(page.locator('.diff-lines-container')).toContainText(
    'migrate_legacy_plaintext_tokens',
  );
  await page.locator('[data-file-key="auth"]').click();
  await page.locator('#mockup-btn-apply').click();
  await expect(page.locator('#mockup-btn-apply')).toContainText('Patch Applied');
  await page.locator('#mockup-btn-discuss').click();
  await expect(page.locator('#mockup-view-ai')).toBeVisible();
  await page.locator('#mockup-btn-refresh').click();
  await expect(page.locator('#mockup-btn-refresh')).toBeDisabled();
  await expect(page.locator('#mockup-btn-refresh')).toContainText('Up to date');
});

test('channels, custom version picker, empty channels and hero remain independent', async ({
  page,
}) => {
  const stable = release('v1.0.2');
  await open(page, [release('v1.0.3-beta'), release('v1.0.2-beta'), stable], {
    platform: 'Win32',
    userAgent: 'Windows Win64 x64',
  });
  const stableURL = await page.locator('#hero-download-btn').getAttribute('href');
  expect(stableURL).toContain('/v1.0.2/');
  await page.locator('#release-browser [data-release-channel="beta"]').click();
  await expect(page.locator('[data-download-key="windowsExe"]')).toHaveAttribute(
    'href',
    /v1\.0\.3-beta/,
  );
  await expect(page.locator('[data-asset-size-for="windowsExe"]')).toHaveText('· 10 MB');
  await page.locator('#release-version-trigger').click();
  await page.locator('[data-release-tag="v1.0.2-beta"]').click();
  await expect(page.locator('[data-download-key="windowsExe"]')).toHaveAttribute(
    'href',
    /v1\.0\.2-beta/,
  );
  await expect(page.locator('#selected-release-link')).toHaveAttribute(
    'href',
    /tag\/v1\.0\.2-beta/,
  );
  await expect(page.locator('#hero-download-btn')).toHaveAttribute('href', stableURL);
  await expect(page.locator('[data-release-channel="nightly"]')).toHaveCount(0);
  await page.locator('#release-schedule [data-release-channel="stable"]').click();
  await expect(page.locator('#release-version-label')).toHaveText('v1.0.2');
});

for (const width of [320, 375, 768, 1440])
  test(`responsive layout and base-path assets at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const failed = [];
    page.on('response', (response) => {
      if (response.url().startsWith('http://127.0.0.1') && response.status() >= 400)
        failed.push(response.url());
    });
    await page.emulateMedia({
      colorScheme: width === 1440 ? 'dark' : 'light',
      reducedMotion: 'reduce',
    });
    await open(page, [release()]);
    await page.screenshot({ path: `test-results/hero-${width}.png`, animations: 'disabled' });
    for (const section of ['#download', '#release-history', '#comparison', '#release-schedule']) {
      await page.locator(section).scrollIntoViewIfNeeded();
      expect(
        await page
          .locator(section)
          .evaluate((el) => el.getBoundingClientRect().right <= innerWidth + 1),
        section,
      ).toBe(true);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
    }
    await expect(page.locator('.hero-visual')).toBeVisible({ visible: width > 640 });
    expect(failed).toEqual([]);
    await page
      .locator('#release-history')
      .screenshot({ path: `test-results/archive-${width}.png`, animations: 'disabled' });
  });

test('stable downloads remain available when the newest 100 releases are previews', async ({
  page,
}) => {
  const stable = release('v0.0.4');
  await open(
    page,
    (url) =>
      url.pathname.endsWith('/latest')
        ? stable
        : Array.from({ length: 100 }, (_, i) => release(`v1.0.${i}-beta`)),
    { platform: 'Win32', userAgent: 'Windows Win64 x64' },
  );
  await expect(page.locator('#hero-download-btn')).toHaveAttribute('href', /\/v0\.0\.4\//);
  await expect(page.locator('#release-version-label')).toHaveText('v0.0.4');
  await expect(page.locator('#release-history-list')).toBeEmpty();
  await expect(page.locator('#release-history-load-more')).toBeVisible();
});

for (const [label, platform, key, os] of [
  [
    'Apple Silicon',
    {
      platform: 'MacIntel',
      userAgent: 'Macintosh Intel Mac OS X',
      hints: { platform: 'macOS', architecture: 'arm', bitness: '64' },
    },
    'macArm',
    'macos',
  ],
  [
    'Intel Mac',
    {
      platform: 'MacIntel',
      userAgent: 'Macintosh Intel Mac OS X',
      renderer: 'AMD Radeon Pro 5500M',
    },
    'macIntel',
    'macos',
  ],
  [
    'Fedora on a Mac host',
    { platform: 'MacIntel', userAgent: 'X11 Fedora Linux x86_64' },
    'linuxRpm',
    'linux',
  ],
])
  test(`device detection updates the ${label} card and recommended download`, async ({ page }) => {
    await open(page, [release()], platform);
    await expect(page.locator(`#card-${os}`)).toHaveClass(/highlight/);
    await expect(page.locator(`[data-download-key="${key}"]`)).toHaveClass(/download-recommended/);
    const download = await page.locator(`[data-download-key="${key}"]`).getAttribute('href');
    await expect(page.locator('#hero-download-btn')).toHaveAttribute('href', download);
  });

test('custom version picker supports Escape and outside-click dismissal', async ({ page }) => {
  await open(page);
  await page.locator('#release-version-trigger').click();
  await expect(page.locator('#release-version-picker')).toHaveAttribute('open', '');
  await page.keyboard.press('Escape');
  await expect(page.locator('#release-version-picker')).not.toHaveAttribute('open');
  await expect(page.locator('#release-version-trigger')).toBeFocused();
  await page.locator('#release-version-trigger').click();
  await page.locator('#download h2').click();
  await expect(page.locator('#release-version-picker')).not.toHaveAttribute('open');
});

test('an empty Beta channel never reuses Stable package links', async ({ page }) => {
  await open(page, [release('v1.0.2')], { platform: 'Win32', userAgent: 'Windows Win64 x64' });
  const stableURL = await page.locator('#hero-download-btn').getAttribute('href');
  await page.locator('#release-browser [data-release-channel="beta"]').click();
  await expect(page.locator('#release-channel-status')).toHaveText(
    'No beta releases are available yet.',
  );
  for (const selector of ['[data-download-key="windowsExe"]', '#selected-release-link']) {
    await expect(page.locator(selector)).toHaveAttribute(
      'href',
      'https://github.com/anhquoctran/stage0/releases',
    );
  }
  await expect(page.locator('#hero-download-btn')).toHaveAttribute('href', stableURL);
});
