import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadWithMocks } from './helpers/componentHarness.mjs';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.rs', '.html', '.css', '.json']);
const vietnameseCharacters = /[ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĐđĨĩŨũƠơƯư\u1EA0-\u1EF9]/u;

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(file)
      : sourceExtensions.has(path.extname(file)) ? [file] : [];
  });
}

test('bundled application source contains no Vietnamese copy', () => {
  // Documentation and user-provided content (commit messages, names, etc.) are
  // intentionally outside this check. Normalize decomposed accents as well.
  const files = ['frontend', 'backend/src', 'public'].flatMap((directory) =>
    sourceFiles(path.join(projectRoot, directory)));
  files.push(path.join(projectRoot, 'index.html'));
  const matches = files.flatMap((file) => fs.readFileSync(file, 'utf8')
    .split('\n')
    .flatMap((line, index) => vietnameseCharacters.test(line.normalize('NFC'))
      ? [`${path.relative(projectRoot, file)}:${index + 1}`] : []));
  assert.deepEqual(matches, [], `Translate application copy to English:\n${matches.join('\n')}`);
});

test('clone URL validation uses English copy and a stable Git message locale', () => {
  const source = fs.readFileSync(path.join(projectRoot, 'backend/src/features/git/ops/remotes.rs'), 'utf8');
  const validation = source.slice(source.indexOf('pub fn check_git_remote_url('));
  assert.ok(validation.includes('Repository is valid and ready to clone.'));
  assert.ok(validation.includes('Please enter a repository URL.'));
  assert.ok(validation.includes('cmd.env("LC_ALL", "C")'));
});

test('English-only source retains Vietnamese author-name transliteration', () => {
  const { getAuthorHandle } = loadWithMocks(
    new URL('../frontend/features/virtual-mr/utils/discussionAuthorUtils.ts', import.meta.url), {
      '../../../common/utils/dateTime': { formatTime: (value) => value },
    });
  assert.equal(getAuthorHandle('Nguyễn Huỳnh Duy'), '@duynh');
  assert.equal(getAuthorHandle('Đặng Đình Đức'), '@ducdd');
  assert.equal(getAuthorHandle('đức'), '@duc');
});

test('reviewer handles use the bot name instead of abbreviating the Stage0 AI display wrapper', () => {
  const { getAuthorHandle } = loadWithMocks(
    new URL('../frontend/features/virtual-mr/utils/discussionAuthorUtils.ts', import.meta.url), {
      '../../../common/utils/dateTime': { formatTime: (value) => value },
    });
  assert.equal(getAuthorHandle('Stage0 AI (Code Reviewer)', 'bot-id', 'ai_agent'), '@code-reviewer');
  assert.equal(getAuthorHandle('Stage0 AI (Security & Quality)', 'bot-id', 'ai_agent'), '@security-quality');
  assert.equal(getAuthorHandle('Code Reviewer', 'user@local.stage0', 'ai_agent'), '@code-reviewer');
  assert.equal(getAuthorHandle('', undefined, 'ai_agent'), '@reviewer');
  assert.equal(getAuthorHandle('Jane (Doe)'), '@doej');
  assert.equal(getAuthorHandle('Jane Doe', 'jane.doe@example.com'), '@jane.doe');
});
