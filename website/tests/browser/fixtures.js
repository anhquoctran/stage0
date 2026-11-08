import { test as base, expect } from '@playwright/test';

export { expect };
export const names = [
  'aarch64-unknown-linux-gnu-Stage0_arm64.deb',
  'aarch64-unknown-linux-gnu-Stage0_arm64.rpm',
  'x86_64-unknown-linux-gnu-Stage0.AppImage',
  'x86_64-unknown-linux-gnu-Stage0.deb',
  'x86_64-unknown-linux-gnu-Stage0.rpm',
  'aarch64-apple-darwin-Stage0.dmg',
  'x86_64-apple-darwin-Stage0.dmg',
  'aarch64-pc-windows-msvc-Stage0.exe',
  'x86_64-pc-windows-msvc-Stage0.exe',
];
export const digest = 'abcdef0123456789'.repeat(4);
export function release(tag = 'v1.0.2', files = names) {
  return {
    tag_name: tag,
    published_at: '2026-11-07T00:00:00Z',
    html_url: `https://github.com/anhquoctran/stage0/releases/tag/${tag}`,
    assets: files.map((name) => ({
      name,
      size: 10 * 1024 ** 2,
      digest: `sha256:${digest}`,
      browser_download_url: `https://github.com/anhquoctran/stage0/releases/download/${tag}/${name}`,
    })),
  };
}
export const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('https://cloud.umami.is/**', (route) => route.abort());
    await page.addInitScript(() => {
      window.clipboardWrites = [];
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: async (text) => {
            window.clipboardWrites.push(text);
          },
        },
      });
    });
    await use(page);
    expect(errors, 'No hydration or runtime errors').toEqual([]);
  },
});
export async function open(page, releases = [release()], platform) {
  const requests = [];
  await page.route('https://api.github.com/repos/anhquoctran/stage0/releases**', (route) => {
    const url = new URL(route.request().url());
    const data = typeof releases === 'function' ? releases(url) : releases;
    if (url.pathname.endsWith('/latest')) {
      const stable = Array.isArray(data)
        ? data.find((release) => /^v\d+\.\d+\.\d+$/.test(release.tag_name))
        : data;
      return route.fulfill(stable ? { json: stable } : { status: 404, json: {} });
    }
    requests.push(url.href);
    return route.fulfill({ json: data });
  });
  if (platform)
    await page.addInitScript((data) => {
      for (const [key, value] of Object.entries(data))
        if (key !== 'hints' && key !== 'renderer')
          Object.defineProperty(navigator, key, { value, configurable: true });
      Object.defineProperty(navigator, 'userAgentData', {
        value: data.hints
          ? { platform: data.hints.platform, getHighEntropyValues: async () => data.hints }
          : undefined,
        configurable: true,
      });
      if (data.renderer)
        HTMLCanvasElement.prototype.getContext = () => ({
          getExtension: () => ({ UNMASKED_RENDERER_WEBGL: 1 }),
          getParameter: () => data.renderer,
        });
      else HTMLCanvasElement.prototype.getContext = () => null;
    }, platform);
  await page.goto('./');
  await expect(page.locator('#release-channel-status')).not.toHaveText('Loading releases…');
  return requests;
}
