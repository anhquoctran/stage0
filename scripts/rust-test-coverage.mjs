import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const ignore = '(/tests(/|\\.rs$)|_tests\\.rs$|/test_repo\\.rs$|/test_http_server\\.rs$|regression_test_contracts\\.rs$)';
fs.mkdirSync(new URL('../coverage/rust/', import.meta.url), { recursive: true });
fs.rmSync(new URL('../coverage/rust/lcov.info', import.meta.url), { force: true });
for (const args of [
  ['--locked', '--manifest-path', 'backend/Cargo.toml', '--lib', '--lcov', '--output-path', 'coverage/rust/lcov.info', '--ignore-filename-regex', ignore],
  ['report', '--manifest-path', 'backend/Cargo.toml', '--html', '--output-dir', 'coverage/rust', '--ignore-filename-regex', ignore],
]) {
  const result = spawnSync('cargo', ['llvm-cov', ...args], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) { process.exitCode = result.status ?? 1; break; }
}
