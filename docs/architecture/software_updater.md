# Software updates through GitHub Releases

Stage0 uses `tauri-plugin-updater` 2.14+ with the public `anhquoctran/stage0`
repository. No update server, client GitHub token, AI call or source upload is
required. The webview's CSP is unchanged; raw updater plugin commands are not
granted frontend capabilities.

## Runtime ownership and trust

Backend `features/updates/` owns shared state, bounded HTTPS transport, the
GitHub-only URL policy and check/download/install workflows. IPC commands are
`get_software_update_status`, `check_software_update`, `download_software_update`,
`install_software_update` and `consume_software_update_release_notes`. Callers
cannot supply URLs, keys or packages.

The installed package SemVer selects one fixed channel endpoint:
`https://github.com/anhquoctran/stage0/releases/download/channel-stable/latest.json`,
`channel-beta/latest.json` or `channel-nightly/latest.json`.
Unknown prereleases cannot cross into a supported channel. Manifest candidate
versions must match the installed channel. Changing channels requires installing
the desired build; no new user preference or client-supplied URL is introduced.
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
The target version is persisted before replacement. On restart, only the main
window consumes that marker, and only when its running package version matches;
it then opens the existing Release Notes dialog once. Failed installs clear the
marker, and other windows cannot consume it.

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
3. Push the commit and `vMAJOR.MINOR.PATCH` or dated nightly/beta tag. The workflow can also be
   dispatched with an existing tag. Tag/version drift blocks the build.
4. `.github/workflows/release.yml` checks architecture, TypeScript and Node tests,
   runs Rust tests on Linux and builds four targets. It calls `tauri build`
   directly: **the build matrix never bumps versions**. Local packaging also preserves the selected version; use `pnpm version:set VERSION` to change it explicitly.
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

The local package verifier can authenticate one package without installing it:

```bash
cargo run --locked --manifest-path scripts/release-verifier/Cargo.toml -- \
  --package backend/target/release/bundle/appimage/Stage0_0.1.12_amd64.AppImage 0.1.12
```

Local verification on Fedora 44 does not establish compatibility with older
Ubuntu systems; the published Linux packages are built on Ubuntu 22.04 by CI.

## Release channels and version reset

`shared/release-channels.json` is the canonical base/cadence policy. Stage0
restarts at **0.0.1** in Q4 2026. `scripts/release-channels.mjs` validates
channel versions and derives scheduled versions in UTC. Stable has no suffix;
`-stable` is a SemVer prerelease and is rejected by the release gate.

- Nightly: `0.0.2-nightly.20261031.42`, daily at 17:17 UTC (00:17 Vietnam next day).
- Beta: `0.0.2-beta.20261101.43`, Sundays at 17:47 UTC (Monday 00:47 Vietnam).
- Stable: first day of January/April/July/October at 00:17 UTC. The next
  scheduled stable is `0.0.2` on January 1, 2027.

Each quarter advances the base PATCH once from the configured epoch; previews
target the following stable core. The date is the UTC build date and the last
identifier is the Actions run number. SemVer compares `nightly` above `beta`
lexically for an equal core; separate feeds intentionally avoid cross-channel
promotion. Calendar cadence does not infer API compatibility. Maintainers must
change the base/epoch deliberately for a future MINOR/MAJOR release.

`scheduled-release.yml` prepares a detached release commit with synchronized
versions and metadata, pushes only its immutable tag, and calls the existing
release workflow directly (GITHUB_TOKEN tag pushes do not trigger another
workflow). Main remains unchanged. Every platform builds the exact tag; per-target
About metadata is regenerated before packaging. Successful signed publication
marks nightly/beta as GitHub prereleases with latest=false; only stable becomes
latest. Channel alias releases are prereleases containing only latest.json;
the manifest points at immutable version-tagged, signature-verified assets.
A single publication concurrency group protects channel-feed updates.

Schedules become active after these workflows reach the default branch and
Actions is enabled. Signing secrets remain required. GitHub cron is best-effort
and may be delayed; this task does not push tags or publish remote releases.

The deliberate reset from 0.1.x to 0.0.1 is a SemVer downgrade. Existing 0.1.x
installations need one manual installation; the updater's downgrade/replay
protections remain enabled. The new stable feed also avoids accidentally
offering legacy 0.1.x releases to a fresh 0.0.1 installation. No old Git tags
or GitHub Releases are deleted or rewritten.

Verification for the reset/channel change: architecture, TypeScript, Cargo check,
30 focused release/version/About/updater Node tests and 8 updater Rust tests
passed. Both workflow files parse as YAML. Older UI assertions in the selected
release-notes/updater tests were updated to use translation keys, retaining
ordering, saved-work confirmation and progress assertions. No remote Actions
run, multi-platform installer build, tag push or publication was performed.
