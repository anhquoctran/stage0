# Native OS notifications

`features/notifications` owns notification delivery and permission IPC. The
custom transparent toast WebView, its queue, geometry and visibility commands
have been removed. Native UI owns placement, lifetime and appearance. The
notification drawer remains a local history view, not a replacement popup.

## Platform adapters

- macOS uses UserNotifications, an app-lifetime delegate and completion blocks.
  Read `UNNotificationSettings` before delivery. Ask for authorization only from
  an explicit user action, and only while authorization is not determined.
  Denied authorization returns a message code; it never schedules a notification.
  Unbundled executables are unsupported rather than calling an API that raises
  an Objective-C exception. Test with Stage0's app bundle and stable bundle ID.
  Before initializing UserNotifications, refresh only the current app's Launch
  Services registration (`LSRegisterURL` with update enabled). macOS resolves
  the native sender icon from that identity, not React's `AppLogo`. The dev
  runner writes a content-hashed ICNS filename into `CFBundleIconFile` and drops
  stale runner-owned icon resources before signing. Logo changes invalidate
  that resource name without changing bundle ID or notification permissions.
- Windows uses Windows Toast with the Stage0 application identity and reads
  `ToastNotifier.Setting`. Blocked settings are denied; missing registration is
  unsupported. Windows does not provide a macOS-style permission dialog for
  desktop apps. Installed builds are required for the correct app identity.
- Linux uses the Freedesktop notification service. A reachable service is
  `system_managed`, not proof that desktop policy permits a banner. No fake
  permission prompt is shown. The compositor owns display and expiration.
  At most 64 active listener connections are kept, including notifications
  without action buttons, so GNOME does not withdraw them when a sender closes.

## Permission and delivery

Permission belongs to the OS, never localStorage, SQLite, Keychain or JSON
preferences. Preference channel toggles remain independent and retain their
values after a denial. Request authorization from the shared permission panel
in Onboarding's startup step or Preferences / Notifications. Onboarding can
continue after rejection. The panel refreshes on focus and app-wide permission
events; it provides an explicit link to OS notification settings.

The backend serializes permission requests across WebViews in a blocking worker
and retains its gate if the requesting WebView goes away. Ordinary delivery and
preview delivery never request permission. Backend and frontend both respect
channel preferences. History is recorded before delivery permission is checked;
previews never enter history. A denial is reported as `denied`, an undecided
permission as `permission_required`; neither uses a custom-toast fallback.

Native notification buttons/clicks route the existing notification actions to
one user window. Requests arriving before any WebView is ready are queued
(maximum 50) until its history/action listeners acknowledge readiness. Per-window
generations prevent late cleanup from disabling a newer subscription; reload
and destroy discard the old routing registration. The Preferences utility cannot
consume history actions, which wait for a workspace/Welcome window. A default
click opens notification history; custom actions retain their original targets.
Existing payload IDs and serialized fields are retained;
`dismissPolicy` and `autoDismissMs` are legacy wire fields and are not applied
to native surfaces. The OS can suppress banners through Focus/Do Not Disturb
even when delivery was accepted. A successful send does not prove visibility.

## Verification

Backend tests cover permission wire values and delivery gates. Frontend tests
cover refusal without fallback, explicit requests, permission refresh, channel
filters, stable history IDs, partial registration cleanup and late subscriptions.
On macOS, architecture, TypeScript, Cargo check, all 15 locale catalogs and the
23 focused notification/IPC/Preferences tests passed. The full Rust suite passed
279 tests with `--test-threads=1`; its parallel run exposed a flaky database-lock
test that also passed in isolation. The wider frontend selection passed 62/64;
the remaining onboarding assertions expect an older locale order and square
dialog class and were not changed as part of notification delivery.
Actual OS prompts, Windows installed-app identity, Notification Center clicks,
GNOME/KDE/Xfce policy and Focus modes require native platform checks.
The action queue is in memory while Stage0 runs. Relaunching a terminated app
from a retained Windows notification would require a separate COM activation
registration; this adapter does not implement that lifecycle.

## Reviewer completion

Review runtime completion sends once after final state persistence and coordinator
release, independent of frontend polling, open windows, manual commands or new
finding counts. Completed and partial runs notify (including zero findings and
discussion replies); unsuccessful or unsaved final states do not claim completion.
The notification ID derives from the run ID. Delivery runs in a blocking worker,
reads the global UI language and reuses backend channel/OS authorization gates.
Notification delivery failure is diagnostic and cannot turn a saved successful
review into a failed review. Manual-request UI only posts the discussion summary.
