# Database storage and reset

Stage0 uses ordinary bundled SQLite through rusqlite. The database is not
encrypted and opening it does not read the OS credential vault, derive a
machine-specific password, or create `database-key.json`. API keys, Git tokens
and preference secrets retain their existing OS-vault storage.

`core/db/mod.rs` owns initialization, schema upgrades and connection access.
`storage.rs` opens the database, applies private permissions (0700 directory,
0600 database/lock on Unix), rejects database and sidecar symlinks, and holds
an exclusive process lock for the lifetime of the connection. WAL, connection
locking, transactions, parameterized feature queries, and schema migrations are
unchanged.

Previously encrypted or unreadable files are never silently replaced. Startup
returns an instruction to reset local state or use a compatible older build.
This build does not decrypt or migrate SQLCipher databases. Old encrypted
backups still need their matching OS-vault key and an encryption-capable build.

## First-launch reset

Close Stage0, then run `pnpm reset:app-state -- --yes`. Without `--yes`, the
script prints a dry-run plan. It moves active application data (including the
database, JSONC preferences and local files), WebView storage, caches and native
window preferences into a dated `Stage0 Reset Backups` directory. On macOS this
includes both bundle-ID and legacy `stage0` WebKit/cache locations. A failed move
rolls back already moved paths. Symlink targets and running app instances are
rejected.

The next launch creates an empty database and default settings and displays
onboarding. The reset preserves OS-vault secrets, source repositories, installed
external tools and shell/system integrations. Clearing settings and credential
references prevents those retained secrets from restoring prior configuration.
The old database key is no longer accessed by this build.

## Verification

`storage_tests.rs` covers a normal SQLite header and password-free reopen,
retention of unreadable files, exclusive locking, private permissions and
database/sidecar symlink rejection. Existing DB tests retain SQL parameterization,
schema migration, credential-reference and filename-migration coverage.
