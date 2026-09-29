# Security Policy

## Supported Versions

We provide security patches and updates for the following versions of Stage0:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1.0 | :x:                |

---

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
