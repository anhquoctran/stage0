# Software updates through GitHub Releases

Stage0 uses `tauri-plugin-updater` 2.14+ with the public `anhquoctran/stage0`
repository. No update server, client GitHub token, AI call or source upload is
required. The webview's CSP is unchanged; raw updater plugin commands are not
granted frontend capabilities.

## Runtime ownership and trust

Backend `features/updates/` owns shared state, bounded HTTPS transport, the
GitHub-only URL policy and check/download/install workflows. IPC commands are
`get_software_update_status`, `check_software_update`, `download_software_update`
and `install_software_update`. Callers cannot supply URLs, keys or packages.

The fixed endpoint is
`https://github.com/anhquoctran/stage0/releases/latest/download/latest.json`.
Manifest responses are limited to 1 MiB, downloads to 512 MiB. Only GitHub and
its release asset hosts are allowed, with HTTPS and at most five redirects.
Checks time out after thirty seconds and downloads after ten minutes. Selected
URLs must belong to the official repository and exact `v<version>` tag.

Tauri compares actual application SemVer, not About's display build metadata.
`restore_update` selects the platform and enforces a version-bound Minisign
signature. `verify` authenticates bytes before they become installable; the
official installer verifies again before replacement. `requireSignedVersion`
blocks pairing an old signed package with a forged newer manifest version.
Same/older releases are not offered. Notes are bounded and displayed as plain text.

Frontend `features/updates/` owns typed transport, Zustand state, reference-counted
event subscriptions, the About panel, notice and dialog. Events have monotonic
revisions so stale IPC responses cannot overwrite newer progress. A process-wide
backend operation lock serializes updater operations across all windows.

## User choice and active work

Installed builds check after a 45-second delay, then at most daily. The last
attempt is persisted in SQLite across restarts. Checks do not block startup. `general.autoCheckUpdates` defaults
to true; About saves it immediately through the existing preferences service.
Invalid preferences disable automatic checks. Manual checks remain available.
Checks never download/install automatically. Debug/dev builds do not check.

Users confirm that work in every Stage0 window is saved before installation;
this does not claim to discover/save arbitrary editor drafts. `common/activity/`
atomically reserves installation only when there is no active work. Reviews, Git
mutation leases, bounded subprocesses and ACP process lifetimes hold operation
leases. New work in those paths is rejected after installation is reserved.
Local Worktree/Docker sandbox instances must be closed through Sandbox settings
before installation, including on Windows where the installer exits directly.
Instance creation/destruction also participates in the activity gate.
SQLite's committed state is checkpointed before replacement; storage locks remain
held until process exit. All windows display an installation overlay. A normal
installation failure releases the gate and preserves verified bytes for retry.
Windows requests installer relaunch; macOS/Linux restart after replacement.

The gate does not control unrelated applications or add an OS sandbox to external
agents. Existing process limits, cancellation and review publication checks remain.

## Installation channels

| Platform | Updater payload | Initial installation |
|---|---|---|
| Linux x86_64 | AppImage | AppImage |
| Windows x86_64 | NSIS installer | NSIS installer |
| macOS Apple Silicon | `.app.tar.gz` | DMG/app |
| macOS Intel | `.app.tar.gz` | DMG/app |

Debian/RPM packages are also distributed. This initial integration leaves their
upgrades to the package manager/manual installation; other Linux bundle types
cannot install the manifest's AppImage. Linux ARM and Windows ARM are not built.
Older Stage0 versions without updater support need one manual upgrade.

The first workflow uses macOS ad-hoc signing, without Apple notarization;
Gatekeeper can require explicit user approval. Windows is not Authenticode
signed. Updater signatures do not replace OS publisher certificates. Add those
workflow credentials when they are available.

## Release procedure

1. Commit one version shared by `package.json`, `Cargo.toml`, `Cargo.lock` and
   `tauri.conf.json`, with current `RELEASE_NOTES.md`.
2. Set Actions secret `TAURI_SIGNING_PRIVATE_KEY` to the private key matching
   `plugins.updater.pubkey`; set `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` for an
   encrypted key. Never commit either private value.
3. Push the commit and stable `vMAJOR.MINOR.PATCH` tag. The workflow can also be
   dispatched with an existing tag. Tag/version drift blocks the build.
4. `.github/workflows/release.yml` checks architecture, TypeScript and Node tests,
   runs Rust tests on Linux and builds four targets. It calls `tauri build`
   directly: **do not use auto-bumping `scripts/build.mjs` in the build matrix**.
   Target OS/architecture metadata is explicit for cross-architecture Mac builds.
5. After all builds succeed, the publisher assembles `latest.json` and checksums.
   Its offline Rust verifier authenticates every update package and signed
   version against the embedded public key, using Tauri's Minisign library.
6. Upload all assets to a draft, then publish it as latest. A published release
   cannot be overwritten by this workflow. Failed builds/signature checks leave
   the previous stable release available.

The initial private key lives outside Git under the release operator's private
`~/.local/share/stage0-release/` directory. Back it up securely and reuse it for
future releases. Losing it requires a manual migration; rotation needs a planned
transition release.

`scripts/release-artifacts.mjs` owns asset naming, manifest/checksum generation
and version consistency. `scripts/release-verifier/` is a small standalone tool
so publication does not rebuild the desktop app; its lockfile is committed.
Checksums are diagnostic and do not replace signature verification.

## Verification

Run architecture/type checks, Node tests, backend Cargo check/tests and
`cargo test --locked --manifest-path scripts/release-verifier/Cargo.toml`.
Validate the workflow with `actionlint .github/workflows/release.yml`. Signature
fixtures use a discarded test key, never the production private key, and make
no network/installation calls. Installed-app smoke tests are still needed on
Windows, both Mac architectures and supported Linux desktops.
