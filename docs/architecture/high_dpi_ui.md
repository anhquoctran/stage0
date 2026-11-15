# High-DPI UI contract

Stage0 uses CSS/logical pixels for layout and physical pixels for raster image
resolution. OS display scaling remains authoritative. Density (Standard, Compact,
Touch) controls spacing and targets independently; fonts retain their preferences.
A 28 CSS pixel control stays 28 CSS pixels at 100%, 150%, 200% and 400% scaling.
The WebView draws it using the corresponding number of display pixels.

## Research and audit

[Tauri's DPI reference](https://v2.tauri.app/reference/javascript/api/namespacedpi/)
distinguishes logical creation/CSS sizes from physical monitor/window measurements.
For example, a 3840 × 2160 monitor at 200% has approximately 1920 × 1080 logical
pixels, before subtracting the taskbar/dock. Resolution alone does not determine
the appropriate UI size; use the configured monitor scale and work area.

[Microsoft's per-monitor guidance](https://learn.microsoft.com/en-us/windows/win32/hidpi/high-dpi-desktop-application-development-on-windows)
requires responding to runtime scale changes. The locked Tao 0.37.1 runtime
already requests Per-Monitor V2 on Windows, with fallbacks for older systems
(`src/platform_impl/windows/dpi.rs`). Stage0 does not override that runtime policy
or multiply the document's CSS sizes by `devicePixelRatio`. WKWebView and WebKitGTK
likewise retain their native display scaling. Native bundle/driver behavior still
requires validation on the actual target platform.

[MDN's devicePixelRatio guidance](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio)
explains backing-store sizing for canvas and resolution media queries for monitor
changes. Stage0's ordinary icons, Git graph, identicons and typography already use
vector/browser rendering. The audit found these gaps:

| Area | Previous behavior | Implementation |
| --- | --- | --- |
| Native window geometry | Fixed workspace/Preferences defaults and minimums could exceed a scaled display's work area | Convert physical work area and frame measurements once into logical client bounds; clamp both initial sizes and minimums |
| Moving between monitors | No application work-area constraint update on scale changes | Handle `ScaleFactorChanged` after the runtime transition; preserve splash, maximized and fullscreen geometry |
| Windows unread badge | A single cached 16 × 16 bitmap | Render a bounded DPR-sized backing store; invalidate cache when its pixel size changes |
| Commit avatar | Fixed 80 px request at every display size/density | Native `srcset` candidates follow the displayed logical size, including monitor changes |
| Sourcetree preset logo | 32 px favicon | 256 px export from the official vector logomark, keeping its local filename and 24 CSS px presentation |
| Portal rendering | A duration-only class implicitly animated visibility/geometry, preventing initial search focus with the production CSS | Limit the transition to opacity and focus without scrolling the viewport |

## Ownership and invariants

- `core/window_manager/display_geometry.rs` owns monitor fitting, native frame
  subtraction, work-area centering and runtime scale transitions. Sizes are logical;
  final centering positions are physical, including negative monitor origins.
  Reserve 16 logical pixels at each work-area edge. Keep default dimensions on
  sufficiently large work areas; reduce minimum dimensions only when required to
  fit. An unavailable monitor preserves existing defaults. Wayland placement
  remains compositor-owned. Do not clear maximize/fullscreen or deferred startup
  intent on monitor changes.
- Startup owns its existing hidden handoff and minimum/size application order;
  it obtains the same fitted geometry plan as reset and Preferences. Preferences
  remains a singleton with its Apply/Cancel transaction and native close policy.
- `common/utils/displayScale.ts` owns bounded raster scale and a shared,
  event-driven resolution/resize observer. Re-arm the media query after a change;
  unsubscribe all listeners with the last subscriber. There is no polling or
  persisted per-monitor scale preference.
- `notifications/services/notificationBadgeService.ts` owns the 16 logical pixel
  dot. Its backing store is `ceil(16 × DPR)`, bounded to DPR 8, with normalized
  drawing coordinates. Only the current resolution is cached. Failed encoding
  can retry; an older encode cannot overwrite a newer clear/update.
- Commit avatars use native image density candidates, preserving lazy loading,
  privacy headers, stable identity hashing and the SVG fallback. Requests remain
  within [Gravatar's supported 1–2048 px range](https://docs.gravatar.com/sdk/images/).
  A low-resolution user-uploaded original cannot gain detail from a larger request.
  Externally supplied avatar/attachment URLs are not rewritten to invent variants.
- Keep vector assets and fonts at logical dimensions. Do not globally apply
  `transform: scale`, `zoom`, `image-rendering: pixelated`, or force one-physical-
  pixel strokes: these can distort fractional scaling, text or graph connections.
  Locally bundled raster preset logos have at least enough source pixels for
  their 24 CSS px presentation at DPR 4.

## Verification and acceptance

The protected browser suite uses actual Chromium contexts with `deviceScaleFactor`
1, 1.25, 1.5, 1.75, 2, 2.5, 3 and 4. It retains the original 375 × 700 logical
viewport and adds scaled desktop viewports down to 960 × 540. Every context runs
all existing dropdown/encoding/density regressions plus the High-DPI tests.

Checks include PNG header dimensions from the real canvas encoder, unchanged
CSS/font/SVG sizes, all three density modes, portal bounds, initial search focus,
keyboard navigation and focus restoration. Reactive monitor subscriptions,
repeated transitions, disposal, failed encoding and stale encode publication have
Node regressions. Rust tests cover defaults, work-area limits, native frame
allowances, fractional scaling and unavailable monitor data.

Browser DPR emulation and pure geometry tests do **not** certify native compositor
rendering. Before a stable release, manually validate packaged builds as follows:

| Platform | Native scenarios |
| --- | --- |
| Windows / WebView2 | 125%, 150%, 175%, 200%, 300%, 400%; move a window between 1080p and 4K monitors; dock/undock; taskbar on each edge; check unread overlay sharpness |
| macOS / WKWebView | Retina 4K/5K/6K and a non-Retina secondary display; default/scaled modes; move between displays; Dock/menu bar; fullscreen and maximize |
| Linux / WebKitGTK | X11 and Wayland at integer/fractional compositor scales; system/custom frames; compositor-owned placement; verify whether the compositor scales the WebView bitmap |

On each platform open/reset Main and Preferences, then inspect diff text, graph
lines, avatars, dialogs, menus and keyboard focus in light/dark themes and each
Density. Typography and icon sharpness need human inspection on physical displays;
there is no claim that every GPU, driver or fractional Wayland setup is certified.
