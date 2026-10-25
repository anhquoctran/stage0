# Database encryption

Stage0 uses bundled SQLCipher 4 through rusqlite. SQLCipher encrypts the SQLite
database and its WAL/journal pages using AES-256 with authenticated pages. The
connection is keyed with `sqlite3_key` before reading any database pages. The
password never appears in SQL text, logs, IPC, frontend storage, or preferences.
The build refuses to open the database if SQLCipher is unavailable.

## Installation key

Each new installation receives a random UUID and 32 bytes from the OS random
source. HKDF-SHA-256 derives a 256-bit password from that secret, a device
fingerprint, and a versioned context containing the installation UUID. A machine
identifier by itself is public/predictable and is not an encryption secret.
Resetting the app creates a different installation and password on the same
machine.

The fingerprint uses macOS `IOPlatformUUID`, the Windows firmware product UUID,
or Linux DMI product UUID when available. Windows falls back to `MachineGuid`;
Linux falls back to the OS `machine-id` when firmware identifiers are not
readable. Virtual machines and cloned OS images do not guarantee unique physical
hardware identifiers. Independent randomness preserves key uniqueness there.
The raw machine identifier and fingerprint are not persisted or logged.

The derived password is stored under OS-vault service `com.stage0.database`,
account `installation-v1/<installation UUID>`: macOS Keychain, Windows Credential
Manager, or Linux Secret Service. Linux requires an available, unlocked Secret
Service. OS permission prompts are respected. There is no file-based secret or
plaintext fallback. Password buffers are zeroized on drop, and SQLCipher memory
security is enabled.

`database-key.json` in the application data directory contains only `version`
and `installation_id`. It is private (0600 on Unix) and must travel with a DB
backup. After creation, the app reads the saved vault password rather than
deriving it again; a hardware upgrade does not invalidate an otherwise usable
vault entry. This is encryption at rest for this user's installation, not TPM
sealing or protection against a process already able to access that OS vault.

If a key/reference is missing, malformed, inaccessible or incorrect, startup
fails with an actionable error and retains the DB. It never regenerates a key
for an existing encrypted database, creates an empty replacement, or retries
with plaintext. Losing the vault key makes encrypted data unrecoverable unless
the same key can be restored from an OS-vault backup.

## Plaintext upgrades

A process-level file lock covers key initialization and stays held for the
entire database connection lifetime. The existing per-connection mutex,
transactions, schema migrations, settings queries and feature persistence remain
the owners of ordinary database operations.

On an old SQLite header, Stage0 checkpoints committed WAL data, requires an
exclusive transaction, and calls `sqlcipher_export` into a private encrypted
scratch file. It explicitly preserves `auto_vacuum`, `user_version`, and
`application_id`; SQLCipher copies the schema, rows, indexes, triggers and views.
The encrypted result passes SQLite integrity and SQLCipher authentication checks
before replacing the original with an atomic filesystem replacement. No
permanent plaintext backup is created by this migration. Failures before
replacement leave the readable original in place. Scratch files left by a
process crash are encrypted and are never used as an automatic recovery source.

WAL remains enabled for ordinary operations. Temporary SQLite storage stays in
memory, and memory mapping is disabled for the encrypted connection. The
existing 64 MiB page-cache budget and cancellation/feature transaction behavior
are unchanged.

## Reset and backup

`pnpm reset:app-state -- --yes` archives the entire application data directory,
including `database-key.json`, then clears the active app/WebView state. It keeps
OS-vault keys so the archived encrypted database can still be restored on the
same installation/user vault. Restoring a DB on another machine requires its
matching vault key as well as the reference file; copying the DB alone is not
enough. A backup made before this feature remains plaintext and is not modified
by an application upgrade. JSONC preferences and WebView localStorage are also
outside SQLite encryption; existing API/OAuth/MCP secrets remain in their own
OS-vault records.

## Implementation and checks

`encrypted_storage.rs` owns keyed opens and file/integrity checks;
`plaintext_migration.rs` owns export/replacement; `encryption_key.rs` owns the
vault/derivation lifecycle; `key_manifest.rs` owns the public reference; and
`machine_identity.rs` owns bounded platform identity reads. Tests inject a fake
key store and operate on disposable directories, never the user's OS vault.

See the [SQLCipher API](https://www.zetetic.net/sqlcipher/sqlcipher-api/) and
[rusqlite SQLCipher features](https://docs.rs/crate/rusqlite/0.41.0).

Verified on macOS: the 198-test Rust library suite, the added native machine-ID
check, dependency-security Node checks, architecture checks, TypeScript checking,
and Cargo checking passed. Encryption/migration tests use real SQLCipher files;
key-lifecycle tests use an injected vault. Native keychain prompts and Windows/
Linux execution have not been exercised. No app was launched and no real
database or OS-vault record was modified during verification.
