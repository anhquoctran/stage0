// Compatibility entry point; the website owns its builder and dependencies.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const result = spawnSync('pnpm', ['build'], {
  cwd: fileURLToPath(new URL('../website/', import.meta.url)),
  stdio: 'inherit',
  env: process.env,
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
