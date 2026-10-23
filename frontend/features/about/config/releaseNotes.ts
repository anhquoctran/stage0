export const DEFAULT_RELEASE_NOTES = `# Stage0 v0.1.11 Release Notes

> **Stage0** — A local-first Virtual Merge Request and Conflict Prediction Sandbox.
> This document details the changes and enhancements included in the **current release (v0.1.11)**.

---

### 🌟 Release Highlights

- **Visual Studio Code Multi-Platform Integration**: Seamlessly launch repositories and files directly into VS Code across Windows, macOS, and Linux (with support for native packages, Snap, and Flatpak).
- **Startup Theme Consistency**: Instant detection and synchronization of Catppuccin themes (Mocha / Latte) on initial application launch, eliminating dark-mode flash.
- **Spacious & Responsive Layouts**: Expanded window minimum dimensions (\`1120×800\`) and widened dialogs to ensure rich content, settings, and release notes display cleanly without truncation.
- **Standardized Form Controls**: High-contrast, circular radio button design applied across all application preferences and configuration forms.

---

### 🚀 Detailed Changes in v0.1.11

#### 1. Code Editor & Platform Integration
- Added dedicated platform-specific launcher logic for Visual Studio Code (\`vscode_launcher.rs\`).
  - **macOS**: Detects application bundles (\`/Applications/Visual Studio Code.app\`), Homebrew binaries (\`/opt/homebrew/bin/code\`, \`/usr/local/bin/code\`), and falls back to \`open -b com.microsoft.VSCode\`.
  - **Linux**: Resolves standard system binaries, Flatpak wrappers (\`org.visualstudio.code\`), and Snap packages (\`/snap/bin/code\`).
  - **Windows**: Handles \`code.cmd\`, \`code.exe\`, and PATH resolutions.
- Added friendly, actionable toast notifications when VS Code is not installed or not in PATH, guiding users with installation and configuration links.

#### 2. Theme & Visual Experience
- Eliminated light-theme startup flashing by syncing the theme cache (\`stage0_catppuccin_theme_mode\`) immediately prior to React tree mounting.
- Styled badges with high-contrast text and solid backgrounds for clear visibility across all Catppuccin color palettes.
- Refined navigation menus to remove unintended bold weighting on AI menu items.

#### 3. Forms & Component Uniformity
- Created reusable circular \`Radio\` component with accessible keyboard navigation and Catppuccin accent focus rings.
- Replaced custom or inconsistent radio buttons in Sandbox Settings, Git Binary Management, and Repository Bot Inheritance cards.

---

### 📊 Feature & Platform Compatibility Matrix

| Capability / Platform | Windows 10/11 | macOS (Apple Silicon / Intel) | Linux (X11 / Wayland) |
| :--- | :---: | :---: | :---: |
| **Virtual MR & Conflict Prediction** | ✅ Full Support | ✅ Full Support | ✅ Full Support |
| **VS Code Direct Launcher** | ✅ (\`code.cmd\` / PATH) | ✅ (Bundle / \`open -b\`) | ✅ (Native / Flatpak / Snap) |
| **Catppuccin Mocha & Latte Themes** | ✅ Native Sync | ✅ Native Sync | ✅ Native Sync |
| **Top Menu Bar (Tauri Frame)** | ✅ Embedded Custom | ✅ Native macOS Menu | ✅ Embedded Custom |
| **Local Git Sandbox Adapters** | ✅ In-process | ✅ In-process | ✅ In-process |

---

### ⌨️ Useful Keyboard Shortcuts

| Shortcut | Description |
| :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>,</kbd> / <kbd>Cmd</kbd> + <kbd>,</kbd> | Open Preferences dialog |
| <kbd>Ctrl</kbd> + <kbd>I</kbd> / <kbd>Cmd</kbd> + <kbd>I</kbd> | View Repository Overview |
| <kbd>Ctrl</kbd> + <kbd>R</kbd> / <kbd>Cmd</kbd> + <kbd>R</kbd> | Reload current sandbox state |
| <kbd>Esc</kbd> | Dismiss active modal or overlay |

---

### 🛡️ Safety & Architecture Note

> [!NOTE]
> Stage0 operates entirely on local repository clones and in-memory or sandbox virtual refs.
> Your working tree files and remote branches are never modified without explicit confirmation.

---

### 🔗 Feedback & Documentation

- **Documentation**: [https://github.com/anhquoctran/stage0](https://github.com/anhquoctran/stage0)
- **Report an Issue**: [https://github.com/anhquoctran/stage0/issues](https://github.com/anhquoctran/stage0/issues)
- **License**: MIT License © 2026 Anh Quoc Tran
`;
