# Stage0 website

The `website` branch owns GitHub Pages independently of the desktop release
branches. Create website work branches from `origin/website` and target `website`
with their PRs. Do not promote website-only work through Develop, Nightly, Beta,
or Main. This is the website-specific exception to the application's Git flow.

## Development and verification

Use Node 24 and pnpm 12.14.0. This directory has its own manifest, lockfile and
SvelteKit 3 / Svelte 5 dependencies; installing the desktop application is not
necessary.

```sh
pnpm --dir website install --frozen-lockfile
pnpm --dir website dev
```

Before opening a PR, verify the actual GitHub Pages base path:

```sh
pnpm --dir website check
BASE_PATH=/stage0 pnpm --dir website build
pnpm --dir website test
pnpm --dir website exec playwright install chromium
pnpm --dir website test:browser
```

Browser tests start a production preview themselves. On a machine using an
existing Chrome install, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its binary.
The browser suite covers release selection, stable-only filtering, API errors,
pagination, clipboard, themes, navigation, the desktop demo and 320–1440px layouts.
Node tests cover device detection, trusted asset URLs, request/cache behavior,
static HTML, bundling and retained responsive contracts. Static-output tests need
a build first. `node scripts/build-website.mjs` remains a compatibility build entry
point, using this directory's dependencies.

## Ownership

- `src/routes/+page.svelte`: composition and per-page release state lifecycle.
- `src/lib/sections/`: compiled page content and section-local interactions.
- `src/lib/mockup/`: interactive demo views and their Svelte state.
- `src/lib/releases/`: shared release state, GitHub API/cache client, platform
  detection, safe asset classification, recommendations and release archive UI.
- `src/lib/components/CopyButton.svelte`: clipboard feedback with timer cleanup.
- `src/app.html`: SEO, structured data, external fonts/icons, analytics and the
  pre-render theme initialization. `styles.css` / `mockup.css` preserve the theme.
- `static/`: public icons, robots and sitemap. Source/configuration is never copied
  to the public artifact.

SvelteKit's static adapter prerenders HTML for SEO and bundles/hashes JavaScript
and CSS into `dist/website`. No runtime server is required. `BASE_PATH` defaults
to an empty string locally and is `/stage0` for GitHub Pages. Svelte owns UI state;
there is no legacy `window.Stage0` registry or imperative DOM bootstrap.

## CI and deployment

`Website checks and Pages` runs only for PRs targeting `website` and pushes to
`website`. A single Ubuntu job runs Svelte diagnostics, the static build, Node
contracts and Chromium browser tests using only website dependencies. Deployment
runs only after a checked commit reaches `website`. Application regression, Rust
and release promotion workflows continue to target the application's branches.

The `github-pages` environment permits only `website`. The previous
`Deploy static content to Pages` workflow stays disabled so Main pushes cannot
replace this site. These settings are separate from release branch protections.
