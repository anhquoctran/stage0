import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checkBackendSize, countLines, MAX_BACKEND_FILE_LINES } from './check-backend-size.mjs';

test('line budgets do not depend on trailing newline or platform line endings', () => {
  assert.equal(countLines(''), 0);
  for (const text of ['first\nsecond', 'first\nsecond\n', 'first\r\nsecond\r\n']) {
    assert.equal(countLines(text), 2);
  }
});

test('nested Rust files and the build script are bounded, including tests', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stage0-size-check-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'backend/src/feature'), { recursive: true });
  fs.mkdirSync(path.join(root, 'backend/vendor'), { recursive: true });
  fs.writeFileSync(path.join(root, 'backend/src/lib.rs'), 'line\n'.repeat(500));
  fs.writeFileSync(path.join(root, 'backend/src/feature/tests.rs'), 'line\n'.repeat(501));
  fs.writeFileSync(path.join(root, 'backend/build.rs'), 'line\n'.repeat(502));
  fs.writeFileSync(path.join(root, 'backend/vendor/generated.rs'), 'line\n'.repeat(1000));
  fs.writeFileSync(path.join(root, 'backend/src/feature/notes.md'), 'line\n'.repeat(1000));
  const result = checkBackendSize(root);
  assert.equal(result.maxLines, MAX_BACKEND_FILE_LINES);
  assert.equal(result.files, 3);
  assert.deepEqual(result.violations, [
    { file: 'backend/build.rs', lines: 502 },
    { file: 'backend/src/feature/tests.rs', lines: 501 },
  ]);
});

test('all application Rust files stay within the module budget', () => {
  assert.deepEqual(checkBackendSize().violations, []);
});
