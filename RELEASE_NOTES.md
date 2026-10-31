# Stage0 v0.0.3 Release Notes

Stage0 is a local-first Virtual Merge Request and conflict prediction sandbox.
This document describes the current release (v0.0.3).

## Highlights

- Check for software updates from About, with an optional daily background check.
- Download updates from the official GitHub Releases repository, inspect progress and release notes, and explicitly install/restart after saving work.
- Verify package signatures and signed versions before installation. Active reviews, Git operations and external agent work prevent update installation.
- Support in-app updates for Linux x86_64 AppImage, Windows x86_64 NSIS, macOS Apple Silicon and macOS Intel.
- Build all four targets with one release version; publish the stable update manifest only after all packages pass signature verification.
- Improve Linux desktop title bars, application/Dock identity and Wayland tray detection.
- Keep startup splash sizing and percentage labels consistent.
- Harden reviewer custom instructions and discussion replies with scoped tools, bounded context, thread revision checks and authoritative publication guards.

## Installation

### Compatibility Matrix

| Platform | CPU | Installer | In-app updates |
|---|---|---|---|
| Linux | x86_64 | AppImage | Supported |
| Linux | x86_64 | Debian / RPM | Manual or package manager |
| Windows | x86_64 | NSIS | Supported |
| macOS | Apple Silicon | DMG / app | Supported |
| macOS | Intel | DMG / app | Supported |

Choose the asset matching your platform and CPU. Existing versions without an updater require a manual installation of this release once.

- Linux: use AppImage for in-app updates. Debian and RPM packages remain available for manual/package-manager installation.
- Windows: install the x86_64 NSIS setup executable. Windows ARM is not included.
- macOS: install the matching Apple Silicon (`aarch64`) or Intel (`x86_64`) DMG/app.

The initial macOS packages use ad-hoc signing and are not notarized by Apple; Gatekeeper may require approval in Privacy & Security. The Windows installer is not Authenticode signed. All updater payloads are separately signed with Stage0's update key.

Updates never upload repository content or invoke AI services. Automatic checks can be disabled in About; downloading and installation always require user actions.

## Verification scope

Automated Node/Rust tests and Linux build checks are run before publication. CI compiles the native release packages on Linux, macOS and Windows. Compilation does not replace installed-app smoke testing on each supported desktop.
