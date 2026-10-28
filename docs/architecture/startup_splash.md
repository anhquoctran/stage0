# Determinate startup splash

The splash reports completed startup work through a percentage, current phase
label and step count. It does not estimate elapsed time, transfer bytes or an ETA.
Unknown-duration work holds its current value until a real checkpoint completes.
There is no indeterminate animation or timeout that reveals an unfinished app.

## Phases and owners

The single weighted plan lives in `public/startup.js`; its IDs match
`core/services/startup/StartupPhase.ts`. Weights sum to 100.

| Phase | Weight | Completion checkpoint |
|---|---:|---|
| Starting Stage0 | 10 | Runtime and legacy settings setup in `main.tsx` |
| Loading preferences | 20 | Preferences initialization, migration and appearance cache |
| Loading interface | 20 | Application and error-boundary modules imported |
| Preparing window | 10 | Window context/listeners registered, or existing fallback selected |
| Loading repositories and sandboxes | 15 | Recent repositories, available sandboxes and active sandbox have settled |
| Preparing workspace | 20 | Repository initialization/attachment completed; matching Virtual MR data is no longer loading |
| Opening main screen | 5 | Ready React tree committed and given a paint opportunity |

The repository catalog reports three independently completed operations through
Git's optional `RepositoryInitializationProgress` callback. All settle before
startup advances, including recoverable failures. Existing repository error
fallbacks remain in their owning workflows; an observer cannot interrupt them.
Workspace reaches its midpoint after initialization and startup-repository
attachment. Core observes Git loading and the Virtual MR repository ID/path and
loading flag before completing that phase. An empty welcome window does not need
repository data. Main-layout coordination remains the sole owner of MR loading.

Optional fonts, notifications and other background services do not form startup
checkpoints. Startup does not add provider inference or credential reads.
Auxiliary notification windows retain their separate splash-removal path.

## Lifecycle and presentation

- All native platform configurations, including Linux's override, start at
  600×380 logical units with matching minimum bounds, without resizing or
  maximization. This follows OS DPI scaling once; screen resolution does not
  switch the splash to workspace bounds. The hidden readiness handoff restores
  the normal workspace geometry, resizing and maximization capabilities.
- The macOS main window stays hidden during startup and remains borderless after
  the readiness handoff; the React title row draws the traffic lights and owns
  drag/double-click behavior. Dynamically created windows use the same custom
  frame. Native application menus remain available through macOS.
- The bootstrap controller is available before React loads. Its typed core
  facade safely delegates when present. Without the controller, a ready main
  application removes the static overlay directly.
- Fractions are clamped to 0–1 and never decrease. Repeated completion is safe;
  phase labels do not move backward. Unknown phases are ignored.
- Completion refuses to skip unfinished phases. The core hook waits two animation
  frames before publishing 100%, then the bootstrap transitions the final fill
  and fades the overlay. Cleanup cancels both pending frames and dismissal timers.
- Runtime/script failures, unhandled rejections and caught React errors freeze
  progress, identify the interrupted phase and offer **Reload Stage0**. Error
  details shown on the splash contain no raw exception or sensitive URL. Optional
  stylesheet/image failures do not prevent an otherwise functional startup.
- The progress bar exposes its current value, label and detail through ARIA;
  phase changes use a polite status announcement. Reduced motion disables the
  fill/fade transitions. Early saved/system theme selection is preserved.
- Status, percentage and step detail belong to a footer anchored directly to the
  splash, separate from the centered branding. Status stays at the footer's top
  left; step detail and percentage share the row above the progress track. The
  percentage reserves four monospace character widths at the right edge, so
  changing digits or wrapping phase labels cannot move it into the logo area.
- Keep progress surfaces and the reload button at a 4px radius; the opaque reload
  button has no border and keeps a separate keyboard focus outline.

## Verification

`scripts/startup-progress.test.mjs` covers weighted work, monotonic values, ARIA,
completion guards, cancellation, reduced motion, reload/error states, optional
resource failures, actual repository task settlement, window subscription cleanup
and matching workspace readiness. Use the usual typecheck and architecture gate.
Visual checks should include light/dark progress, startup failure and transition
to the actual welcome or repository workspace.

On Fedora GNOME/Wayland with LG 2560×1440 displays at 100% scale (2026-10-26),
the native protocol reports an initial 600×380 surface followed by the maximized
workspace bounds after readiness. The configuration regression covers the base,
macOS and Linux overrides. MacBook/Windows visual DPI checks remain separate.
