# Security alert remediation — 2026-11-03

This review covers GitHub Dependabot alerts 1–3 and CodeQL alerts 1–20,
plus a fresh npm/RustSec dependency audit. Alerts were read from the default
branch, `main`; the original fix was merged into `develop` through PR #16.
The same security changes are backported through `hotfix/main/security-alerts`
and synchronized through `hotfix/beta/security-alerts` and
`hotfix/nightly/security-alerts`. No integration/release branch is pushed directly.
GitHub counters are not evidence that a working-branch fix has reached a
published release. Merge, promotion and a new default-branch scan are required.

## ZIP dependency and release compatibility

`cargo tree --target all` exposed `zip 4.6.1` through the default `zip` feature
of `tauri-plugin-updater 2.14.0`. A host-only tree on macOS misses this Windows
dependency. ACP already used `zip 9.0.5` independently.

| Dependabot | Advisory | Impact described by upstream | Fixed floor |
|---|---|---|---|
| 1, critical | [GHSA-m665-v7pm-7grj](https://github.com/zip-rs/zip2/security/advisories/GHSA-m665-v7pm-7grj) | Local/central-header disagreement enables parser differentials, including file overwrite in affected extraction integrations | 9.0.5 |
| 2, high | [GHSA-q7v9-x93c-xqv3](https://github.com/zip-rs/zip2/security/advisories/GHSA-q7v9-x93c-xqv3) | Unbounded symlink-target allocation can exhaust memory or abort extraction | 9.0.0 |
| 3, moderate | [GHSA-8hxf-qr8p-62x4](https://github.com/zip-rs/zip2/security/advisories/GHSA-8hxf-qr8p-62x4) | Early EOF can bypass AES entry authentication | 9.0.0 |

The updater's legacy ZIP/gzipped-AppImage compatibility feature is disabled;
Rustls TLS and system proxy support remain enabled. Current feeds use raw signed
Windows EXE, raw Linux AppImage/DEB/RPM and macOS `app.tar.gz` payloads. The
updater's macOS TAR extraction is unconditional and remains available. Legacy
Tauri v1 zipped Windows installers and gzipped AppImages are intentionally not
accepted by this build. Release manifest tests enforce current payload formats
for all required architectures.

The lockfile contains only `zip 9.0.5`; its direct requirement now sets that
minimum explicitly. ACP explicitly calls `validate_header_consistency()` before
any extraction writes: `by_index()` alone does not opt into this new validation.
This rejects mismatched local/central filenames, duplicate names and overlapping
entries. ACP keeps bounded extraction, safe relative paths, confined
link materialization, staging and executable validation. New integration tests
feed mismatched ZIP filenames and the upstream tiny ZIP64 symlink fixture into
the actual extractor and require rejection before writing files. AES is not an
enabled feature of ACP's parser. None of these findings establishes that an
unsigned attacker payload could bypass Stage0's existing updater signature and
version checks; those checks remain mandatory.

## Additional dependency audit findings

- Vite moves from 6.4.3 to 6.4.5, covering development-server advisories
  GHSA-698v-4r3x-3vcv, GHSA-r825-w8mm-5pxw, GHSA-587h-7wmj-h5pm,
  GHSA-9jrq-w75r-8gcw and GHSA-rq7h-c2jc-7f22.
  Real-DOM security tests use jsdom 29; the Node engine range is aligned with
  its supported releases (20.19+, 22.12+, or 24+). Release CI already uses 24.
- `rustls-webpki` moves to 0.103.16 for
  [RUSTSEC-2026-0382](https://rustsec.org/advisories/RUSTSEC-2026-0382.html).
- JWT verification uses jsonwebtoken's supported `aws_lc_rs` provider instead of
  `rust_crypto`, removing `rsa 0.9.10` (RUSTSEC-2023-0071) and
  `crypto-bigint 0.5.5` (RUSTSEC-2026-0387). Stage0 only verifies public identity
  signatures, so the private-key timing attacks were not established as
  reachable. Removing affected implementations avoids retaining that exposure.
  Algorithm, JWK, issuer, audience, expiry, nonce and signature validation remain
  unchanged; the real-signature OAuth fixture tests cover the backend change.
- Tokio moves to 1.53.3 for the AsyncFd I/O-safety warning
  [RUSTSEC-2026-0386](https://rustsec.org/advisories/RUSTSEC-2026-0386.html).
  Yanked `async-executor 1.14.0` and `yoke-derive 0.8.3` are also refreshed.

AWS-LC requires a native C/C++ compiler; Windows ARM64 specifically requires
clang-cl. Its [supported platforms](https://aws.github.io/aws-lc-rs/platform_support.html)
include both Windows, macOS and Linux architectures used by Stage0. Local
verification on macOS ARM64 does not establish Windows/Linux build success;
the native release matrix remains the authoritative packaging gate.

RustSec still reports maintenance notices for `proc-macro-error`, `zbus_names`,
`zvariant` and `zvariant_derive` inherited from desktop dependencies. These
notices are not suppressed or presented as fixed. Replacing GTK3 or upgrading
the desktop dependency stack is separate work. The existing GLib security
backport remains byte-verified against upstream provenance.

## CodeQL remediation and triage

| Alert | Location | Disposition |
|---|---|---|
| 1–5 | Release workflow | Main-ref preparation dispatches a separate tag-ref run. Only tag runs validate/build/publish, each pinning `github.sha`; the controller never executes the prepared tag's code in main's cache scope. Preloaded trusted tooling prepares version data. Automatic caching remains disabled. |
| 6–7 | `common/utils/sanitizeHtml.ts` | Replace bespoke DOM rewriting/regex fallback with DOMPurify. Keep explicit HTML/attribute allowlists, internal references, local attachments, external-link isolation and remote-image privacy. Reject control characters in URLs. Without a supported DOM, escape the entire input as text. Test mutation payloads, namespace switches, DOM clobbering, event handlers and tracking URLs. |
| 9 | `manualReviewerRequestService.ts` | Escape untrusted Markdown link labels and titles, including backslashes and backticks; do not attempt to escape backticks inside an inline-code span. Malicious filenames cannot inject another link/image. |
| 10–13 | Git `fileActions.ts` | Parse URLs and inspect hostname boundaries; path, credentials or suffix lookalikes cannot select Azure routing. Encode refs, file paths, commits and query parameters separately. |
| 8 | `scripts/helpers/componentHarness.mjs` | Replace regex tag stripping with parse5 tree-to-text projection. React receives text children; nested malformed markup and encoded tags are verified against actual React DOM output. |
| 14–19 | Vendored GLib FFI | Complete SARIF paths join incompatible generic conversions or confuse an element's pointee with its array allocation. Native optimized probes verify actual typed/ownership contracts. Classified as false positives with individual evidence; see [flow review](codeql_ffi_review.md). |
| 20 | Vendored GLib `log.rs` | The actual UUID path returns `gboolean` → `bool`; the reported panic is in the distinct `FromGlib<u32>` LogLevel implementation. No UUID text reaches that sink. Classified as a false positive; see [flow review](codeql_ffi_review.md). |

The six pointer alerts cover these upstream FFI boundaries:

- `object.rs` `FromGlibPtrNone/Full::from_glib_*` are unsafe conversion methods;
  callers must provide a valid live GObject with the declared ownership. The
  reference-count read and `NonNull` construction rely on that contract. A null
  check alone would not validate a dangling or incorrectly typed pointer.
- `value.rs` `copy_into_value` and `clear_value` operate on allocated/initialized
  GValues. `copy_value` allocates zeroed destination storage before initialization;
  `free_value` clears the stored value before releasing that allocation.
- `subclass/boxed.rs` registers paired copy/free callbacks for the same concrete
  `T`; copying clones a valid boxed `T`, and freeing reconstructs the matching
  `Box<T>` exactly once. Arbitrary IPC data is not a valid callback pointer.
- `collections/ptr_slice.rs` `truncate` drops initialized elements within the
  current length, decreasing the length before each drop and clearing the slot.
  Allocation, length and element validity are the owning collection's invariants.

These observations do not constitute a proof of memory safety for all GLib
callers. The exact seven findings have now been reviewed against the complete
SARIF paths and additional native tests; their false-positive assessment is
documented in [the flow review](codeql_ffi_review.md). Vendor sources and
analyzer coverage remain unchanged. New findings require a fresh assessment.

## Verification

Original `develop` fix verified locally on macOS ARM64 with Node 22.23.1:

- `pnpm check:architecture`, `pnpm typecheck`, `pnpm check:i18n`: passed.
- `pnpm test`: 612 passed; no failures or skipped tests.
- `cargo test --locked --manifest-path backend/Cargo.toml --lib -- --test-threads=1`:
  326 passed, including real OAuth signature validation and archive rejection.
- `cargo check --locked --manifest-path backend/Cargo.toml`: passed.
- Optimized independent GLib probe: 3 passed; vendor integrity checks passed.
- A direct Vite production bundle with `configFile: false` passed without
  running Stage0's metadata/version preparation. Existing chunk-size and mixed
  static/dynamic-import warnings remain.
- `pnpm audit`: zero advisories at all severities. `cargo audit`: zero
  vulnerabilities, seven unmaintained-package notices, no unsound/yanked warnings.
- `cargo tree --locked --manifest-path backend/Cargo.toml --target all -i zip`:
  only `zip 9.0.5`, directly owned by Stage0.

No native Windows/Linux packaging, notarization or live update installation was
performed locally. The original dependency fix did not dismiss alerts; the
later FFI review supplies evidence for triaging the seven remaining library findings.

## Default-branch follow-up

The later eight-alert list consists of the original ZIP alerts 1–3 plus five
Vite/embedded launch-editor alerts 4–8 listed above. It is not eight additional
vulnerabilities introduced by the fix. PR #17 independently upgraded `main` to
Vite 6.4.5, but `main` still contained ZIP 4.6.1 after PR #16 merged into
`develop`. Dependabot scans the default branch, so an integration-branch fix
alone cannot close those ZIP alerts.

The `main` hotfix backports the security commit without promoting unrelated
development changes. Fresh verification on that source passed 596 Node tests,
313 Rust library tests, architecture, TypeScript, i18n and `cargo check --locked`.
Its Cargo/npm dependency manifests and lockfiles match the original verified
fix. RustSec again reports zero vulnerabilities and seven maintenance notices.
The `beta` backport has the same complete source tree as this `main` hotfix;
`nightly` preserves its existing UI changes. Both include the Vite 6.4.5 update
and passed focused security tests, architecture and TypeScript checks.

The equivalent changes already exist in `develop` through PR #16; no redundant
development backport is required. GitHub's alert state must still be checked
after the `main` hotfix merges and dependency analysis completes.

## Remaining CodeQL findings — 2026-11-04

Disabling automatic package-manager caching did not resolve alerts 1–5:
an executed checkout can obtain runtime cache credentials even without an
explicit save step. The release controller now runs trusted preparation code
on `main`, then dispatches `release.yml` with `ref` set to the prepared tag.
Only that tag-scoped run executes validation/build/publication, pinning the
event's immutable SHA and checking it against the controller's expected SHA
before checkout. The cache write scope is the tag, not `main`.

Manual stable preparation and cron scheduling keep their existing version,
immutable rerun, architecture, signature and publication-time contracts. A tag
dispatch resolves the existing version instead of preparing another stable
release, and the tag run cannot recursively dispatch itself. The controller
uses metadata/version functions loaded before switching source revisions;
checked-out channel scripts are never executed in its main-ref context.

The controller needs `actions: write` to dispatch its child run. The scheduled
caller delegates that permission explicitly. The Actions summary links the
tag-scoped build and says it was requested, not that it has published.
Synchronize this workflow change to `nightly` and `beta` before enabling the
new controller on `main`: tag dispatch uses the workflow definition at that tag.

Alert 8 is addressed by parse5 tree-to-text projection in the test-only Trans
fixture, replacing regex tag stripping. React DOM tests confirm malformed
markup and encoded tags remain inert text children.

For alerts 14–20, the complete SARIF paths and native ownership regressions
support individual false-positive dispositions. See [the GLib flow
review](codeql_ffi_review.md); vendor hashes and CodeQL coverage are unchanged.

Follow-up validation on macOS ARM64: 620 Node tests, eight optimized native
GLib tests, architecture, TypeScript, actionlint 1.7.12 and application
`cargo check --locked` passed. npm audit reports zero advisories. The dispatch
API is tested through an injected HTTP client; no real release was triggered
to validate these changes.
