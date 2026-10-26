# Linux desktop window integration

Stage0 supports GNOME, KDE Plasma and Xfce window integration. This is an
implementation contract; native runtime coverage on each desktop must be recorded
separately from macOS checks and tests with simulated desktop settings.

## Frame selection

`appearance.linuxTitleBar` is optional, accepts `system` or `custom`, and defaults
to `system` on Linux. General Settings exposes the choice only in the native Linux
app. Apply saves it through the existing Preferences transaction; Cancel discards
the draft. A restart applies the choice to existing windows. Newly created windows
use the saved selection. Other operating systems retain their existing chrome.

The compact splash stays undecorated. During the hidden main-window handoff,
`core/window_manager/startup_window.rs` enables native decorations for System mode.
React waits for the native chrome profile before dismissing the splash, suppresses
custom window buttons and the inner frame border in System mode, and keeps the
application menu visible in a compact menu/version row without repeating the
window title or brand. Linux centering is best effort because Wayland controls
placement. System mode delegates decoration, theme and supported controls to the
desktop/toolkit; the Stage0 content palette remains an application preference.

For a Wayland window created without decorations, Tao installs an empty GTK
EventBox as the title bar. Enabling decorations does not remove that placeholder.
The hidden handoff fills the empty placeholder with a native GTK HeaderBar on the
GTK main thread, using the desktop button layout and binding its title to the
window. Existing title bars and X11 system frames remain toolkit-owned. Custom
mode keeps the borderless title bar and application controls.

## Development Dock icon

An unbundled Linux dev executable has no package-installed desktop entry. Before
GTK initializes, `core/desktop/dev_desktop.rs` gives development windows the
program name `<identifier>.dev` and registers a user-local desktop entry with that
same ID and StartupWMClass. GNOME/Wayland uses it to resolve the application name
and official 512px icon. This does not enable GTK's separate application bus
registration; Tauri's existing single-instance routing remains authoritative.

The entry lives at `$XDG_DATA_HOME/applications/com.stage0.app.dev.desktop`, with
the icon under `$XDG_DATA_HOME/icons/hicolor/512x512/apps/`; the default data root
is `~/.local/share`. Its Exec command launches the current compiled executable,
so no shell, Node or pnpm is needed when launching the already-built app from the
Dock. Vite must still be running for development windows. Recompiling/reopening
dev refreshes changed paths or icons without rewriting identical files. It never
overwrites the production desktop entry. Remove these two dev files to unregister
the launcher. Packaged Linux builds retain Tauri's installed desktop entry and
icon handling; they do not write the development entry.

Fedora GNOME/Wayland verification (2026-10-26): the protocol reports
`xdg_toplevel.set_app_id("com.stage0.app.dev")`, matching the desktop filename and
StartupWMClass. `desktop-file-validate` passes, GIO resolves the desktop entry and
the icon matches `backend/icons/icon.png` byte for byte. A second native launch
exits successfully and focuses the existing window. Nine desktop Rust tests pass,
including GIO execution from paths with spaces and reserved characters. Ubuntu,
X11 and packaged RPM/Deb/AppImage runtime coverage remain unverified.

## Desktop settings

`backend/src/core/desktop/` owns read-only detection, setting reads and parsing.
`get_window_chrome` returns the current window's native frame state, detected
desktop/session, supported button placement and double-click action.

| Desktop | Custom-frame settings source |
|---|---|
| GNOME | `gsettings get org.gnome.desktop.wm.preferences button-layout` and `action-double-click-titlebar` |
| KDE Plasma | `[org.kde.kdecoration2] ButtonsOnLeft/ButtonsOnRight` and `[Windows] TitlebarDoubleClickCommand` in `$XDG_CONFIG_HOME/kwinrc`, falling back to `$HOME/.config/kwinrc` |
| Xfce | `xfconf-query -c xfwm4 -p /general/button_layout` and `/general/double_click_action` |

Detection uses colon-separated `XDG_CURRENT_DESKTOP`, then
`XDG_SESSION_DESKTOP`/`DESKTOP_SESSION`. Session detection uses `XDG_SESSION_TYPE`
and `WAYLAND_DISPLAY`. Missing tools, unreadable files and unknown desktops keep a
safe Minimize/Maximize/Close fallback. Commands have a 750ms timeout and bounded
output; the KDE configuration read is capped at 64KiB. No shell is invoked and no
desktop settings, theme files or global environment overrides are written.

Custom mode follows placement/order/visibility of Minimize, Maximize and Close.
Other decoration actions (shade, sticky, keep above, etc.) belong to System mode.
Double-click supports maximize, minimize or no action. Unsupported actions perform
no action. The frontend refreshes on focus and committed preference publication,
rejects late responses and removes listeners on unmount.

`TopBarTitleRow.tsx` has one drag/double-click owner: Linux custom frames use the
application's native window commands; Windows/macOS retain Tauri's built-in drag
region handling. Interactive menu/buttons never initiate a window drag. A failed
maximize request does not flip the UI state; focus/resize refresh native state.

## Tray host availability

Wayland tray creation requires an owned `org.kde.StatusNotifierWatcher` name and
its `IsStatusNotifierHostRegistered` property to be true. Stock GNOME sessions
may have no such host. In that case Stage0 skips optional tray setup rather than
letting libappindicator fall back to the X11-only GtkStatusIcon implementation,
which produces `gtk_widget_get_scale_factor: GTK_IS_WIDGET` criticals on Wayland.
GNOME users who want a tray icon must enable an AppIndicator/StatusNotifier host
and restart Stage0. The application does not install or enable extensions.
Actual X11 sessions keep their legacy tray behavior. The Dock identity is
independent of the system tray.

## Application menu

Menus remain application-rendered on Linux. Popup placement clamps to the webview,
opens nested menus to the left when needed, and scrolls tall lists. F10 focuses the
menu bar, Left/Right move between headings, Up/Down navigate items, and Escape
closes menus and returns focus to the trigger. Menu actions/keymap ownership stays
with the shared application-menu/keymap contracts.

## Native verification matrix

On Ubuntu and Fedora, exercise the installed native application under GNOME and
KDE Plasma; include Xfce on a supported session. Cover Wayland and X11 where the
desktop offers them, stock and third-party GTK/decorations themes, both button
sides, hidden buttons, 100/125/150% scale, multiple windows and long repository
names. Check splash handoff, edge/corner resize, drag, maximize/restore (button and
double-click), minimize/restore from the desktop, close, menu clipping/keyboard
navigation and the file chooser. Browser previews and parser tests do not validate
compositor behavior or native theme rendering.

### Fedora GNOME/Wayland checkpoint (2026-10-25)

Verified the restored native Minimize, Maximize/Restore and Close controls through
the running main window's accessibility tree. Invoked Maximize/Restore in both
directions and restored the original geometry state. The desktop GTK regression
also checks title binding, repeated restoration and preservation of standard
toolkit-owned frames. Run it explicitly in a Linux desktop session:

```bash
cargo test --manifest-path backend/Cargo.toml --lib wayland_splash_handoff_restores_native_controls_and_tracks_window_title -- --ignored
```

Cargo check, architecture checks, six Linux frontend chrome tests, 48 core Rust
tests and the explicit GTK regression pass. Startup Node tests report 16 passes
and the existing splash-markup assertion failure. X11, KDE Plasma, Xfce, native
Minimize/Close activation and the remainder of the matrix above remain unverified.
