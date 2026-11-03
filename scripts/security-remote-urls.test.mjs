import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWithMocks } from './helpers/componentHarness.mjs';
const { formatRemoteWebUrl, buildRemoteFileUrl, buildRemoteCommitUrl } = loadWithMocks(
  new URL('../frontend/features/git/utils/fileActions.ts', import.meta.url), {});

test('remote provider classification uses host boundaries rather than paths, credentials or suffix tricks', () => {
  for (const remote of ['https://dev.azure.com.evil.test/org/repo', 'https://evil.test/dev.azure.com/repo',
    'https://evilvisualstudio.com/org/repo', 'https://dev.azure.com@evil.test/org/repo']) {
    const file = new URL(buildRemoteFileUrl(remote, 'main', 'a.ts'));
    const commit = new URL(buildRemoteCommitUrl(remote, 'abc'));
    assert.equal(file.search, '', remote);
    assert.ok(file.pathname.endsWith('/blob/main/a.ts'), remote);
    assert.equal(commit.hostname, new URL(remote).hostname);
    assert.equal(file.username, '');
  }
  const azure = new URL(buildRemoteFileUrl('https://dev.azure.com/org/project/_git/repo', 'feat/a&b', 'a?#&.ts'));
  assert.equal(azure.searchParams.get('path'), '/a?#&.ts');
  assert.equal(azure.searchParams.get('version'), 'GBfeat/a&b');
  assert.equal(azure.hash, '');
  assert.match(buildRemoteFileUrl('https://org.visualstudio.com/project/_git/repo', 'main', 'a'), /\?path=/);
});

test('remote links reject executable schemes, omit credentials and encode file/ref data', () => {
  for (const remote of ['javascript:alert(1)', 'data:text/html,unsafe', 'file:///tmp/repo', 'not a URL']) {
    assert.equal(formatRemoteWebUrl(remote), '');
    assert.equal(buildRemoteFileUrl(remote, 'main', 'file'), '');
    assert.equal(buildRemoteCommitUrl(remote, 'abc'), '');
  }
  assert.equal(formatRemoteWebUrl('git@github.com:org/repo.git'), 'https://github.com/org/repo');
  assert.equal(formatRemoteWebUrl('ssh://git@gitlab.example.test/org/repo.git'), 'https://gitlab.example.test/org/repo');
  assert.equal(formatRemoteWebUrl('https://user:secret@github.com/org/repo.git'), 'https://github.com/org/repo');
  assert.equal(buildRemoteFileUrl('https://gitlab.com/org/repo', 'origin/feat/a', 'folder/a #?.ts'),
    'https://gitlab.com/org/repo/-/blob/feat%2Fa/folder/a%20%23%3F.ts');
  assert.equal(buildRemoteCommitUrl('https://bitbucket.org/org/repo', 'abc?#data'),
    'https://bitbucket.org/org/repo/commits/abc%3F%23data');
});
