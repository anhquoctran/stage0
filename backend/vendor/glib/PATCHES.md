# GLib 0.18.5 security backport

This directory contains the crates.io `glib` 0.18.5 distribution, retaining its
MIT license, copyright notice and API. Registry cache markers are omitted.

- Distribution SHA-256: `233daaf6e83ae6a12a52055f568f9d7cf4671dabb78ff9560ab6da230ce00ee5`
- Upstream revision: `42b9caf98e03ded086362d9653ca58fe94dc8658`
- Advisory: [RUSTSEC-2024-0429](https://rustsec.org/advisories/RUSTSEC-2024-0429.html)
- Fix: [gtk-rs PR #1343](https://github.com/gtk-rs/gtk-rs-core/pull/1343),
  commit `05dff0ee696f9bcd8617cd48c4b812d046d440cb`

The only Rust source change is the upstream two-line fix in
`src/variant_iter.rs`: declare the C out-parameter pointer as mutable and pass
`&mut p` rather than `&p` to `g_variant_get_child`. Text files have a final newline.
No build scripts or additional external dependencies are introduced.

GTK3/Tauri Linux dependencies currently require GLib 0.18.x. Adding GLib 0.20 as
a separate dependency does not repair their copy and is not API-compatible.
`backend/Cargo.toml` uses a crates.io patch so all 0.18.x consumers resolve to
this repaired copy. Windows and macOS application builds do not use this crate.

## Verification

`pnpm test` checks the patch configuration, lockfiles and vendored source integrity.
Run the independent regression tests with optimization enabled:

```sh
cargo test --release --locked --manifest-path backend/security-tests/glib-variant-iter/Cargo.toml
```

The probe needs the platform's GLib development libraries and pkg-config. On
Debian/Ubuntu, install `libglib2.0-dev` and `pkg-config`; on macOS, use Homebrew GLib.
It tests all five affected iterator methods, mixed-direction iteration and empty
arrays without depending on GTK or changing the application's runtime dependencies.

Version-based tools may still flag 0.18.5. Cargo audit skips local path packages,
so a zero vulnerability count does not verify this backport; use the source
integrity checks and optimized runtime probe above. This is a **source backport**,
not an upstream patched release, and its version has deliberately not been falsified.
No advisory is suppressed. Remove this patch when the Tauri/GTK dependency chain
can use an upstream supported, fixed GLib release, and re-run the regression probe
against the replacement.
