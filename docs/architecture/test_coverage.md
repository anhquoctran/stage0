# Application tests and coverage

Application test commands use Node 24, the repository pnpm lockfile, stable Rust,
and the existing single worktree. Website tests/dependencies remain separate.

## Test layers

- `pnpm test`: existing Node regression contracts, frontend harness tests, security
  DOM tests and release/build tooling. Existing assertions remain in place.
- `pnpm test:react`: Vitest with real React DOM, hooks, Zustand, Testing Library
  and JSDOM. Tests live beside their source. New component/hook tests should use
  this layer rather than extending the synthetic React hook implementation.
- `pnpm test:react:browser`: the dropdown/encoding interaction contracts plus
  actual Chromium layout tests at a 375px viewport. Portals must escape clipping,
  stay within viewport bounds and preserve search/keyboard focus. Install Chromium
  with `pnpm exec playwright install chromium`; an existing Chrome executable can
  be selected via `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.
- `cargo test --locked --manifest-path backend/Cargo.toml --lib`: native Rust tests.

Service mocks stop at the application service boundary. React rendering/effects,
portals, event propagation and state stores run normally. JSDOM supplies no layout
engine; only its absent `scrollIntoView` API is shimmed. Chromium tests retain the
browser implementation. A protected Node/real-React-DOM regression additionally
models refusal to focus a hidden element, so portal search focus is checked by
frozen target regressions on all three operating systems.

The real-browser tests found a focus regression: searching a portalled dropdown
attempted focus before its menu had a position and was still `visibility:hidden`.
`CustomSelect` now waits for portal readiness. This fixes the browser behavior
without replacing the original regression harness or weakening its assertions.

## Collect reports

```sh
pnpm test:coverage:react
rustup component add llvm-tools-preview
cargo install cargo-llvm-cov --version 0.9.1 --locked
pnpm test:coverage:rust
pnpm check:coverage
```

Reports are in ignored `coverage/`: frontend and Rust HTML/LCOV plus combined
`summary.md`/`summary.json`. `vitest.config.ts` is independent of application Vite
configuration so collecting coverage never regenerates About/version metadata.

Frontend V8 coverage maps back to the original TS/TSX and includes every application
source, including untested files. Declarations and test files are excluded. The
gate rejects reports omitting any application source; it does not report only
imported/tested modules. Existing Node tests are a separate gate: their dynamically
transpiled harness execution is **not** silently claimed as instrumented frontend
coverage. The initial whole-frontend percentage is therefore low. Expand real
React tests over time; do not hide untouched application files to improve it.

Rust uses the complete library test suite and LLVM source coverage. Standalone
`tests/`, `*_tests.rs`, test repo/server helpers and regression test contract files
are excluded from reports. Inline test modules can still contribute to their
containing source files. Stable Rust does not collect branch coverage here; the
summary reports it as **Not measured**, rather than claiming 0% or 100%. Native
Windows/macOS paths are checked separately by native CI, not inferred from the
Linux coverage percentage.

`shared/test-coverage.json` records nonzero whole-application floors and stronger
per-file line/function/branch floors for dropdown, dismissal and encoding behavior.
The initial floors follow the measured baseline, not an invented 80% global claim.
React runs reject skipped/todo/empty tests and hidden retries.
Coverage below a floor, empty/malformed reports, missing protected files and
lowered/removed floors relative to the trusted PR base fail CI. Ratchet the floors
up as tests are added. An initial rollout with no policy in the base initializes
it; later PRs cannot lower the existing policy through the coverage check.

## CI and branch enforcement

`Protected regressions` runs on PRs into Develop, Beta and Main. All three
OS jobs keep Node tests, frozen target regressions, real React DOM tests and the
complete Rust suite. Ubuntu additionally runs the Chromium contracts and measures
React/Rust coverage, using the instrumented Rust run in place of a duplicate full
uninstrumented run. Release validation also runs the real React DOM suite before
packaging. There is no additional runner matrix or paid reporting service.

The Ubuntu job appends a coverage table to its Actions summary and retains reports
and browser failure diagnostics as `application-test-coverage` for seven days.
Floors and reports are checked inside the already-required regression gate. They
are not advisory jobs with `continue-on-error`.

Use `pnpm configure:regression-checks` for a read-only plan and add `--apply` to
reconcile the owned integration ruleset. The script preflights regression contexts
on every protected branch, preserves unrelated rules/checks, adds Main, and verifies
effective rules after the update. It does not reapply unrelated promotion/ruleset
policy or require all release-controller files to have identical bytes.
