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
| Linux x86_64 | AppImage, `.deb`, `.rpm` | AppImage, `.deb`, `.rpm` |
| Linux aarch64 | `.deb`, `.rpm` | `.deb`, `.rpm` |
| Windows x86_64 | NSIS installer | NSIS installer |
| Windows ARM64 | NSIS installer | NSIS installer |
| macOS Apple Silicon | `.app.tar.gz` | DMG/app |
| macOS Intel | `.app.tar.gz` | DMG/app |

The updater manifest uses bundle-specific targets for Linux, Windows and macOS;
legacy target aliases remain for already installed clients. Debian/RPM updates
use Tauri's native package installer and may request OS authorization. AppImage
is produced for x86_64 only.
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
3. For Stable, open **Actions → Release Stage0 → Run workflow**, select the source branch and run it without entering a tag. CI chooses a free stable version, synchronizes metadata, creates a detached release commit and pushes its tag. A stable tag push alone does not release. Nightly/Beta tags may trigger automatically. Tag/version drift blocks the build.
4. `.github/workflows/release.yml` checks architecture, TypeScript and Node tests,
   runs Rust tests on Linux and builds all nine required editions across six native
   OS/architecture targets. The artifact gate checks every required bundle before
   publication. It calls `tauri build` directly: **the build matrix never bumps
   versions**. Local packaging also preserves the selected version; use
   `pnpm version:set VERSION` to change it explicitly. Target OS/architecture
   metadata is explicit for each build.
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
Windows x86_64/ARM64, both Mac architectures, and Linux x86_64/aarch64 across
AppImage, Debian and RPM packages.

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
- Stable: **manual only** through GitHub Actions → Release Stage0 → Run workflow.
  No tag input or local release commands are required. There is no quarterly cron or automatic Stable
  publication on tag pushes or reusable workflow calls.

Preview target cores advance quarterly from the configured epoch. This only
numbers Nightly/Beta builds; it never creates or publishes a Stable release.
The maintainer chooses the Stable release date and source version line; CI selects the next free PATCH when manually triggered. The date is the UTC build date and the last
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

Stable trigger restriction: only workflow_dispatch can start a Stable release.
The shared validation dependency skips builds/publication for stable tag pushes
and automatic workflow calls. The schedule generator also rejects Stable.

## One-click manual Stable release

`release.yml` starts with a write-scoped preparation job. On workflow_dispatch,
`scripts/manual-release.mjs` uses the selected branch SHA and the package's stable
version line. It selects the first available PATCH above existing stable tags in
that MAJOR.MINOR line; unrelated legacy 0.1.x tags do not undo the 0.0 reset.
The initial unused 0.0.1 is kept. A new Run workflow invocation can advance PATCH;
major/minor changes remain an explicit source-version decision.

Preparation synchronizes package/Cargo/Tauri/About/release notes, creates a
detached commit and pushes only its immutable tag. It does not commit to or push
the selected branch. Commit trailers bind the Actions run ID and original SHA;
Re-run jobs reuses that exact snapshot and rejects a source mismatch. Failed
release runs may leave reserved version tags; a new run selects a new free patch.
The resolved SHA feeds validation, every platform build and publication.
Already-published releases remain protected from replacement. Automatic callers
can only resolve existing nightly/beta tags. Signing credentials and passing
checks are still required; tag preparation does not bypass release verification.

Local verification covers a temporary bare Git remote: initial automatic tag
creation, version synchronization, retry identity, next PATCH selection and
unchanged source-branch/previous-tag refs. No GitHub release was created by these
tests.

One-click verification: actionlint 1.7.7 passed for release.yml and
scheduled-release.yml (shellcheck integration disabled); architecture,
TypeScript, Cargo check and 34 focused Node tests passed. Tests pushed tags only
to temporary local bare repositories. Remote GitHub permissions, signing secrets,
full matrix builds and actual publication still require an Actions run after
these changes are merged.
