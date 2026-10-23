import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getVirtualMrParticipants } from '../frontend/features/virtual-mr/utils/virtualMrParticipants.ts';

test('getVirtualMrParticipants returns empty array for null or undefined session', () => {
  assert.deepEqual(getVirtualMrParticipants(null), []);
  assert.deepEqual(getVirtualMrParticipants(undefined), []);
});

test('getVirtualMrParticipants includes assignee with Creator and Assignee roles', () => {
  const session = {
    id: 'mr-1',
    assignee: {
      name: 'Quoc Tran',
      email: 'quocta@example.com',
    },
    reviewers: [],
    commits: [],
    discussions: [],
  };

  const participants = getVirtualMrParticipants(session);
  assert.equal(participants.length, 1);
  assert.equal(participants[0].name, 'Quoc Tran');
  assert.equal(participants[0].email, 'quocta@example.com');
  assert.equal(participants[0].isAiAgent, false);
  assert.deepEqual(participants[0].roles, ['Creator', 'Assignee']);
});

test('getVirtualMrParticipants includes all reviewers with Reviewer role and isAiAgent=true', () => {
  const session = {
    id: 'mr-1',
    assignee: {
      name: 'Quoc Tran',
      email: 'quocta@example.com',
    },
    reviewers: [
      { agentId: 'bot-1', agentName: 'Architecture Guard', reviewStatus: 'approved' },
      { agentId: 'bot-2', agentName: 'Security Scout', reviewStatus: 'pending' },
    ],
    commits: [],
    discussions: [],
  };

  const participants = getVirtualMrParticipants(session);
  assert.equal(participants.length, 3);

  const bot1 = participants.find((p) => p.name === 'Architecture Guard');
  assert.ok(bot1);
  assert.equal(bot1.isAiAgent, true);
  assert.deepEqual(bot1.roles, ['Reviewer']);

  const bot2 = participants.find((p) => p.name === 'Security Scout');
  assert.ok(bot2);
  assert.equal(bot2.isAiAgent, true);
  assert.deepEqual(bot2.roles, ['Reviewer']);
});

test('getVirtualMrParticipants deduplicates and merges roles for author and commenter', () => {
  const session = {
    id: 'mr-1',
    assignee: {
      name: 'Quoc Tran',
      email: 'quocta@example.com',
    },
    reviewers: [
      { agentId: 'bot-1', agentName: 'Architecture Guard', reviewStatus: 'commented' },
    ],
    commits: [
      {
        hash: 'abc1234',
        shortHash: 'abc1234',
        subject: 'feat: add overview layout',
        authorName: 'Quoc Tran',
        authorEmail: 'quocta@example.com',
        authoredDate: '2026-10-23T10:00:00Z',
      },
      {
        hash: 'def5678',
        shortHash: 'def5678',
        subject: 'refactor: deduplicate participants',
        authorName: 'Alice Cooper',
        authorEmail: 'alice@example.com',
        authoredDate: '2026-10-23T11:00:00Z',
      },
    ],
    discussions: [
      {
        id: 'disc-1',
        sessionId: 'mr-1',
        isResolved: false,
        rootComment: {
          id: 'c-1',
          discussionId: 'disc-1',
          authorType: 'ai_agent',
          authorId: 'bot-1',
          authorName: 'Architecture Guard',
          body: 'Check line length limits',
          createdAt: '2026-10-23T11:30:00Z',
          updatedAt: '2026-10-23T11:30:00Z',
        },
        children: [
          {
            id: 'c-2',
            discussionId: 'disc-1',
            authorType: 'user',
            authorId: 'user-quocta',
            authorName: 'Quoc Tran',
            body: 'Addressed',
            createdAt: '2026-10-23T11:35:00Z',
            updatedAt: '2026-10-23T11:35:00Z',
          },
        ],
        createdAt: '2026-10-23T11:30:00Z',
      },
    ],
  };

  const participants = getVirtualMrParticipants(session);
  // Total participants: Quoc Tran (Assignee/Creator/Author/Commenter), Architecture Guard (Reviewer/Commenter), Alice Cooper (Author)
  assert.equal(participants.length, 3);

  const quoc = participants.find((p) => p.email === 'quocta@example.com');
  assert.ok(quoc);
  assert.ok(quoc.roles.includes('Creator'));
  assert.ok(quoc.roles.includes('Assignee'));
  assert.ok(quoc.roles.includes('Author'));
  assert.ok(quoc.roles.includes('Commenter'));

  const bot = participants.find((p) => p.name === 'Architecture Guard');
  assert.ok(bot);
  assert.ok(bot.roles.includes('Reviewer'));
  assert.ok(bot.roles.includes('Commenter'));

  const alice = participants.find((p) => p.name === 'Alice Cooper');
  assert.ok(alice);
  assert.deepEqual(alice.roles, ['Author']);
});

test('VirtualMrOverviewSidebar and VirtualMrOverviewTab do NOT contain forbidden elements', () => {
  const sidebarSource = readFileSync(
    new URL('../frontend/features/virtual-mr/components/overview/VirtualMrOverviewSidebar.tsx', import.meta.url),
    'utf-8'
  );
  const overviewSource = readFileSync(
    new URL('../frontend/features/virtual-mr/components/hub/VirtualMrOverviewTab.tsx', import.meta.url),
    'utf-8'
  );

  // Must NOT contain Code button, three dots, add a to-do item, milestone, or time tracking
  for (const src of [sidebarSource, overviewSource]) {
    assert.doesNotMatch(src, /\b(milestone|time\s*tracking|add\s*a\s*to-do|three\s*dots)\b/i);
  }

  // Sidebar must contain Assignee, Reviewers, Labels, and Participants
  assert.match(sidebarSource, /Assignee/);
  assert.match(sidebarSource, /Reviewers/);
  assert.match(sidebarSource, /Labels/);
  assert.match(sidebarSource, /Participant/);
});

test('VirtualMrMetadataBar contains AI Reviews tab and NOT Pipelines or Bot Reviews', () => {
  const metadataBarSource = readFileSync(
    new URL('../frontend/features/virtual-mr/components/hub/VirtualMrMetadataBar.tsx', import.meta.url),
    'utf-8'
  );

  assert.match(metadataBarSource, />AI Reviews</);
  assert.doesNotMatch(metadataBarSource, />Pipelines</i);
  assert.doesNotMatch(metadataBarSource, />Bot Reviews</);
});

