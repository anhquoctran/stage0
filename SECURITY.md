# Security Policy

## Supported Versions

We provide security patches and updates for the following versions of Stage0:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1.0 | :x:                |

---

## Dependency Security Backports

The Linux GTK3 dependency chain in Tauri requires GLib 0.18.x. Stage0 applies
the upstream fix for [RUSTSEC-2024-0429](https://rustsec.org/advisories/RUSTSEC-2024-0429.html)
through the local `backend/vendor/glib` crates.io patch. Its provenance,
two-line source change and optimized regression tests are documented in
[PATCHES.md](backend/vendor/glib/PATCHES.md).

GLib's version remains 0.18.5 for GTK3 compatibility. Version-only scanners may
therefore continue reporting this advisory even though the affected source has
been repaired. The alert is not dismissed or ignored. Cargo audit skips local
path packages, so its exit code cannot establish the safety of this backport;
the source integrity checks and optimized runtime probe verify it separately.
Windows and macOS application builds do not include GTK3/GLib. The patch should be
removed when the upstream dependency chain supports a fixed GLib release.

## Reporting a Vulnerability

The Stage0 team takes the security and privacy of developer workflows very seriously. Stage0 runs locally and executes Git subprocesses on your machine, so security vulnerabilities (e.g., command injection, arbitrary path traversal, or unescaped subprocess arguments) are treated with the highest priority.

### How to Report

1. **Do NOT report security vulnerabilities via public GitHub issues, discussions, or pull requests.**
2. Send an email to **[security@stage0.dev](mailto:security@stage0.dev)** or use GitHub's private vulnerability reporting feature under the **Security** tab of the repository.
3. Please include the following details in your advisory:
   - A description of the vulnerability and its potential impact.
   - Operating system and version of Stage0.
   - Step-by-step reproduction instructions or a minimal Proof of Concept (PoC) repository.
   - Any proposed mitigations or fixes if available.

### Response Timeline

- **Initial Acknowledgment**: Within 48 hours of receipt.
- **Triage & Assessment**: Within 5 business days.
- **Fix & Public Advisory**: Coordinated disclosure after a fix has been verified and released.

We appreciate your responsible disclosure and support in keeping open-source developer tooling safe!
