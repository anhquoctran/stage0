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
or `channel-beta/latest.json`. Retired/unknown prereleases cannot select a preview feed.
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
3. For Stable, open **Actions → Release Stage0 → Run workflow**, select the source branch and run it without entering a tag. CI chooses a free stable version, synchronizes metadata, creates a detached release commit and pushes its tag. A stable tag push alone does not release. Beta tags may trigger automatically; retired tags are rejected. Tag/version drift blocks the build.
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

The active private key lives outside Git at `~/.tauri/stage0.key`; the matching
`~/.tauri/stage0.key.pub` is embedded in `backend/tauri.conf.json`. The GitHub
Actions secret must contain that private key's exact file contents. Back it up
securely and reuse it for future releases. Losing it requires a manual migration;
rotation needs a planned transition release.

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

## Release channels and version allocation

`shared/release-channels.json` defines only Beta and Stable. Development integrates
through checked PRs into `origin/develop` and is never packaged as a daily release.
Beta (`origin/beta`, `0.0.x-beta`) accumulates tested development snapshots on
monthly day 27. Stable (`origin/main`, `0.0.x`) accumulates signed published Betas
on January/April/July/October 1. See [release promotion](release_promotion.md) for
period windows, exact-tree CI evidence, human QA, approvals and signed native
build requirements. Empty/unchanged periods do not allocate tags or builds.

The current baseline is **0.0.4**, and the next build receives **0.0.5** (with
`-beta` for Beta). Each release increments PATCH above the baseline and existing
Stable/Beta tags in the current major/minor line. Retired Nightly tags do not
participate in allocation; historical Git refs remain intact. Historical
metadata readers retain old provenance formats; release entry points accept only
suffixless Stable or the short `-beta` suffix. Main remains the production
`--latest` authority even when Beta has a larger SemVer. Stable users never
upgrade automatically to previews.

`promote-release.yml` plans complete periods from trusted Main code.
`publish-rollup.yml` authorizes the exact approved merge, prepares a detached
metadata snapshot and immutable tag, then dispatches isolated `release.yml`
validation and six native builds. Protected source branches remain untouched.
Each platform regenerates About metadata for its target/frozen release date.
Packages/signatures/checksums are verified before leaving the draft state, and
complete promotion authorization is checked again immediately before publication.
Nightly scheduling and the intermediate channel have been removed permanently.

Keep controller changes deployed consistently through reviewed PRs to Develop,
Beta and Main. Manual Stable preparation and tag rebuilds must still satisfy
approved-source authorization. Passing signing/build jobs alone cannot authorize
a release. Never publish a release by bypassing required PR checks or approval.
