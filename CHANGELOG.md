# Changelog

All notable changes to **Stage0** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- Interactive staging and partial hunk commits.
- Git stash list and preview.
- Multi-repository workspace tabs.

---

## [0.1.0] - 2026-09-29

### Added
- **Local Virtual MR Sandbox**:
  - In-memory 3-dot branch comparison (`base...compare`).
  - Merge-base automatic calculation and changed files list with addition/deletion statistics (`numstat`).
  - Safe in-memory merge conflict prediction powered by `git merge-tree --write-tree` with zero disk mutations.
  - Conflict warning banner showing exact conflicting files and resolution tips.
- **Diff Viewer**:
  - Virtualized rendering with `@git-diff-view/react` supporting large file diffs.
  - Side-by-side (Split) and Inline (Unified) diff viewing modes with quick keyboard toggles (<kbd>S</kbd> / <kbd>U</kbd>).
- **Git Blame Integration**:
  - Comprehensive **File Blame** view detailing commit hashes, authors, commit dates, and commit messages.
  - Visual Studio Code-style **Inline Git Blame** showing author and time annotations on the currently active diff line (<kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd>).
- **Toolchain Quick Launch**:
  - Submenu `Open in >` to launch the active repository in:
    - System Default Terminal (<kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>T</kbd>)
    - Visual Studio Code (<kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd>)
    - OS Native File Manager (File Explorer / Finder / File Manager) (<kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>E</kbd>)
  - File-specific actions: Reveal file in native file manager, copy relative path, copy absolute path, and copy remote web URL.
- **Git Synchronization**:
  - Fetch (All & Prune), Quick Pull, and Pull From... advanced options modal.
  - Rebase, Rebase From..., and Rebase Controls (Continue, Skip, Abort).
- **Embedded Database & Watcher**:
  - Embedded SQLite database (`rusqlite` with WAL mode) for recent repositories and review sessions.
  - Real-time debounced file system watcher (`notify`) auto-refreshing diffs on disk/branch changes.
- **Customizable UI & Aesthetics**:
  - Dark and Light monochromatic Catppuccin theme modes.
  - Customizable monospace font family, font size, and ligatures toggle via Preferences modal.
  - Resizable and persistent sidebar.
  - Keyboard shortcuts cheat sheet modal and custom About dialog.
