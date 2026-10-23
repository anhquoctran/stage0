# Keymaps engine

Stage0 resolves configurable application shortcuts from one command registry.
Preferences → General → Keymap selects a preset and edits individual commands.
Help → Customize Keymap opens the same screen. Changes join the existing
Preferences transaction: Apply saves and stays open, OK saves/closes, Cancel
discards changes since the last Apply. Editing a binding updates the draft
immediately; invalid or conflicting drafts cannot be applied.

## Configuration and compatibility

```jsonc
"keymap": {
  "preset": "vscode",
  "overrides": [
    { "command": "fetch", "keys": ["CmdOrCtrl+F8", "Ctrl+F9"] },
    { "command": "pull", "keys": [] },
    { "command": "keymaps", "keys": ["CmdOrCtrl+K CmdOrCtrl+S"] }
  ]
}
```

An omitted override inherits its preset. An empty `keys` array explicitly
unbinds the command. Each command supports up to four alternatives. Removing an
override restores its preset; clearing all overrides retains the selected preset.
Switching presets retains custom overrides and surfaces any new conflicts.
Existing preferences files without `keymap` use Stage0 defaults; no schema-version
bump or destructive migration is needed. JSONC completions include the section,
preset IDs and command IDs. Native validation rejects invalid JSONC saves too.

Resolution order:

1. Menu command defaults in `shared/application-menu.json` and navigation/alias
   defaults in `shared/keymaps.json`.
2. Selected preset's common and platform-specific overlays.
3. Explicit user overrides in `preferences.json`.

The shipped presets are **adaptations of equivalent Stage0 actions**, not full
emulations/importers for another product. Unmatched actions keep Stage0 defaults.
Reference links are also available in the preset UI:

- Stage0 retains the existing menu bindings plus S/U, J/K/arrows, recent-repo
  numbers, MR-tab numbers and Close MR Tab.
- [VS Code](https://code.visualstudio.com/docs/reference/default-keybindings):
  includes the two-step Keyboard Shortcuts binding and terminal binding.
- [JetBrains / IDEA](https://www.jetbrains.com/help/idea/mastering-keyboard-shortcuts.html):
  adapts Settings, Update Project → Pull and file navigation; MR creation is moved
  to avoid its default colliding with Update Project.
- [GitHub Desktop](https://docs.github.com/en/desktop/overview/github-desktop-keyboard-shortcuts):
  adapts Pull, Merge, terminal, preferred editor and file-manager actions; Fetch
  is moved to avoid a collision with the file-manager binding.
- [Fork project-hosted reference](https://github.com/fork-dev/Docs#table-of-contents)
  (community-contributed): adapts Fetch, Pull, Clone, Refresh and external tools.
  macOS uses Command+Control for terminal/file manager and Command+Shift+N for
  Clone; Windows uses Control+Alt for tools, Control+N for Clone and F5 for Refresh.
  New Window is left unassigned rather than conflicting with Clone on macOS;
  the old Preferences alias is omitted because Fork uses that key for tags.
- [SourceTree release notes](https://product-downloads.atlassian.com/software/sourcetree/ReleaseNotes/Sourcetree_4.2.18.html):
  adapts the documented Command+Shift+L Pull and Control+Command+T macOS terminal
  bindings. Non-macOS Pull uses the portable primary modifier; Refresh supports
  F5 and Control+R, matching [reported Windows refresh keys](https://jira.atlassian.com/browse/SRCTREEWIN-14697).
  Other bindings retain Stage0 defaults, not unverified SourceTree equivalence.
- [GitKraken](https://help.gitkraken.com/gitkraken-desktop/keyboard-shortcuts/):
  adapts Fetch All, terminal, file manager, selected-file blame and numbered MR
  tabs. Open Repo replaces the conflicting Clone shortcut. Split/unified view
  shortcuts are unassigned to free numbered tabs and avoid using staging S/U for
  view changes. Pull and Merge have no preset binding: their Stage0 defaults
  overlap GitKraken's palette/commit-focus shortcuts. All remain available in
  menus/buttons and can be explicitly rebound by the user.

Fork and SourceTree Linux configurations are Stage0's portable adaptations of
the non-macOS bindings, not a claim that those external products support Linux.

## Keystrokes and conflict rules

`CmdOrCtrl` means Command on macOS and Control on Windows/Linux. Explicit `Ctrl`
always means actual Control, including on macOS. `Cmd`/`Meta` means the Meta key.
Alt/Option and Shift are supported. Keys include letters, digits, F1–F24,
arrows/navigation and named punctuation (`Equal`, `Backquote`, `Semicolon`, etc.).
Two strokes separated by a space form a chord. In the UI, semicolons separate
alternatives, so use the named `Semicolon` key when binding that physical key.
Recording produces portable primary modifiers, preserving explicit Ctrl+Cmd.
Shifted digits/punctuation and macOS Option-generated symbols use physical code
fallbacks; matching otherwise uses logical key names. This is not a complete
keyboard-layout translation system.

The native and frontend validators check all desktop configurations. Equal keys
and single/chord-prefix ambiguities are rejected when command scopes overlap.
Welcome-only commands can share keys with repository-only commands. System
editing and OS menu roles are read-only; Escape/Tab remain cancel/focus keys.
The OS may intercept additional reserved shortcuts before Stage0 receives them.

## Execution ownership and focus

`useApplicationMenu.ts` installs one capture listener. The engine rechecks live
repository, input/interactive focus, modal/popover state and command gates on
each stroke. Workspace commands pause in input controls, and bare navigation
keys do not hijack buttons/dropdowns. Chords do not hijack input text editing.
IME composition/AltGraph and repeated action keydowns are ignored; held-key file
and conflict navigation retains its repeat behavior.

Chords expire after 1.5 seconds, display a pending-key hint, and cancel on Escape,
blur, mouse interaction, configuration change or engine disposal. Context is
rechecked at completion. Menu commands enter the existing state-gated dispatcher;
tab switches preserve visible-tab filtering and branch-comparison synchronization.
Failures in workspace actions become error toasts, not unhandled promises.

On macOS, native menus own only the first modified, single-stroke application
binding. Workspace keys, additional alternatives and chords stay in the WebView;
the engine skips the native-owned binding to prevent duplicate execution. Native
menus display WebView-owned primary shortcuts as text, without a second native
accelerator. Preferences and tracked dialogs suspend configurable native
accelerators; standard native text-editing roles remain available. Native menu
metadata is window-scoped, restored on focus and removed on window destruction.

The old workspace/tab/welcome listeners and global inline-blame Alt+B listener
have been removed. Intrinsic input/editor/menu behaviors are not application
keymap commands. They keep their local keyboard handling.

## Persistence and maintenance boundaries

The Preferences draft is separate from `usePreferencesStore.keymap`. Failed
commits leave the runtime and saved baseline unchanged; drafts remain editable.
A keymap changed externally since opening the dialog is preserved on unrelated
Apply, or reported as a conflict when the user also edited that keymap. JSONC
revision checks and existing credential rollback remain in the Preferences layer.

`core/services/keymaps/` separates catalog, key syntax, validation, state machine,
live context, dispatch and native ownership. `useCommandShortcut` supplies menu,
toolbar, welcome, context-menu and help text from committed bindings. Shared menu
metadata still owns labels/tree/conditions; presets override keys, not behavior.
Backend `core/keymaps/` validates preferences from both UI and direct JSONC edits.

Coverage includes all bundled presets on macOS/Windows/Linux configurations,
scope and prefix conflicts, unbinding/inheritance, IME/repeat/focus, chords,
native ownership, MR tab dispatch, binding recording and Preferences success,
failure, cancellation and concurrent edits. Configuration tests are not native
Windows/Linux runtime or OS-reserved-key compatibility certification.
