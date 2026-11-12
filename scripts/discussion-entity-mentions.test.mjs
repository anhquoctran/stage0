import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWithMocks } from './helpers/componentHarness.mjs';

const mentions = loadWithMocks(new URL('../frontend/common/utils/mentions.ts', import.meta.url), {});
const { getDiscussionEntityOptions } = loadWithMocks(new URL('../frontend/features/virtual-mr/utils/discussionEntityMentions.ts', import.meta.url), {});
const { directReviewerMentions } = loadWithMocks(new URL('../frontend/features/review/utils/discussionReplyRecipients.ts', import.meta.url), {});
const sha = 'a'.repeat(40), otherSha = 'b'.repeat(40);
const session = { id: 'mr-current', repoId: 'repo-a', title: 'Current MR', commits: [{ hash: sha, subject: 'fix: regression' }] };

test('reference suggestions include only this repository and deduplicate immutable commit identities', () => {
  const options = getDiscussionEntityOptions(session, [session,
    { ...session, id: 'mr-related', title: 'Related MR', commits: [{ hash: sha, subject: 'same commit' }] },
    { ...session, id: 'mr-foreign', repoId: 'repo-b', commits: [{ hash: otherSha, subject: 'foreign' }] },
  ], [{ hash: sha, subject: 'duplicate history' }, { hash: otherSha, subject: 'history fix' },
    { hash: '--all', subject: 'unsafe revision' }]);
  assert.deepEqual(options.filter(item => item.kind === 'mr').map(item => item.id), ['mr-current', 'mr-related']);
  assert.deepEqual(options.filter(item => item.kind === 'commit').map(item => item.id), [sha, otherSha]);
  assert.equal(options.find(item => item.id === sha).description, 'fix: regression');
  assert.equal(options.some(item => item.id === 'mr-foreign' || item.id === '--all'), false);
});

test('MR and commit references round-trip through persisted Markdown without becoming reviewer commands', () => {
  const options = getDiscussionEntityOptions(session, []);
  const body = options.map(item => mentions.formatMention(item)).join(' ');
  for (const option of options) {
    const markdown = mentions.formatMention(option);
    const href = /\]\(([^)]+)\)$/.exec(markdown)[1];
    assert.deepEqual(mentions.parseMentionReference(href), { kind: option.kind, id: option.id });
    assert.equal(markdown.startsWith('[@'), false);
  }
  assert.deepEqual(directReviewerMentions(body, [sha, session.id]), []);
  assert.deepEqual(directReviewerMentions(`${body} [@Bot](#mr-mention/reviewer/bot)`, ['bot']), ['bot']);
  const escaped = mentions.formatMention({ kind: 'mr', id: 'stable-id', label: '[title](javascript:alert) <img>\n' });
  assert.ok(escaped.includes('\\[title\\]')); assert.ok(escaped.includes('\\<img\\>')); assert.equal(escaped.includes('\n'), false);
});

test('reference parsing rejects external URLs, malformed escapes and unsafe Git revisions or MR identities', () => {
  for (const href of ['https://example.test/#mr-mention/commit/' + sha,
    '#mr-mention/commit/HEAD', '#mr-mention/commit/--all', '#mr-mention/commit/abcdef0',
    '#mr-mention/commit/' + sha + '%00', '#mr-mention/mr/%broken', '#mr-mention/mr/a%2Fb',
    '#mr-mention/mr/a%00b', '#mr-mention/mr/a%20b', '#mr-mention/mr/' + 'x'.repeat(129)]) {
    assert.equal(mentions.parseMentionReference(href), null, href);
  }
});

test('reference search still excludes code, quotes, email and existing links', () => {
  for (const value of ['`@abcdef0', '```md\n@MR', '> @MR', 'person@MR', '[already @MR']) {
    assert.equal(mentions.getMentionQuery(value, value.length), null);
  }
  assert.equal(mentions.getMentionQuery('See @abcdef0', 12).query, 'abcdef0');
});

test('full SHA-256 commit identities remain references rather than truncated or ambiguous revisions', () => {
  const hash = 'd'.repeat(64);
  const [option] = getDiscussionEntityOptions({ ...session, commits: [{ hash, subject: 'SHA-256 commit' }] }, [])
    .filter(item => item.kind === 'commit');
  assert.equal(option.id, hash);
  assert.deepEqual(mentions.parseMentionReference(`#mr-mention/commit/${hash}`), { kind: 'commit', id: hash });
});
