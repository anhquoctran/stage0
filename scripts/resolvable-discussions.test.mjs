import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWithMocks, componentHarness, componentNodes } from './helpers/componentHarness.mjs';

const { isResolvableDiscussion } = loadWithMocks(
  new URL('../frontend/features/virtual-mr/utils/discussionReferences.ts', import.meta.url),
  {}
);

test('isResolvableDiscussion identifies code review discussions vs general discussion threads', () => {
  // Code review discussions attached to a file / diff line
  assert.equal(isResolvableDiscussion({ filePath: 'src/main.rs', lineNumber: 42 }), true);
  assert.equal(isResolvableDiscussion({ filePath: 'README.md', lineNumber: 1 }), true);
  assert.equal(isResolvableDiscussion({ filePath: 'src/lib.rs', lineNumber: null }), true);

  // General discussion threads not interacting with any code line
  assert.equal(isResolvableDiscussion({ filePath: null, lineNumber: null }), false);
  assert.equal(isResolvableDiscussion({ filePath: undefined, lineNumber: undefined }), false);
  assert.equal(isResolvableDiscussion({ filePath: '', lineNumber: null }), false);
  assert.equal(isResolvableDiscussion({ filePath: '   ', lineNumber: null }), false);
  assert.equal(isResolvableDiscussion(null), false);
  assert.equal(isResolvableDiscussion(undefined), false);
});

test('DiscussionThread only displays Resolve features for code review discussions', async (t) => {
  const harness = componentHarness();
  const session = {
    id: 'mr_1',
    title: 'Test MR',
    discussions: [],
    reviewers: [],
    assignee: { name: 'Alice', email: 'alice@test' },
  };

  const generalDiscussion = {
    id: 'disc_general',
    sessionId: 'mr_1',
    filePath: null,
    lineNumber: null,
    isResolved: false,
    rootComment: {
      id: 'c_gen_1',
      authorName: 'Bob',
      authorId: 'bob@test',
      body: 'General discussion about architecture',
      createdAt: '2026-10-21T00:00:00Z',
    },
    children: [],
    createdAt: '2026-10-21T00:00:00Z',
  };

  const codeDiscussion = {
    id: 'disc_code',
    sessionId: 'mr_1',
    filePath: 'src/app.rs',
    lineNumber: 15,
    isResolved: false,
    rootComment: {
      id: 'c_code_1',
      authorName: 'Charlie',
      authorId: 'charlie@test',
      body: 'Please refactor this error handling',
      createdAt: '2026-10-21T00:00:00Z',
    },
    children: [],
    createdAt: '2026-10-21T00:00:00Z',
  };

  const { DiscussionThread } = loadWithMocks(
    new URL('../frontend/features/virtual-mr/components/DiscussionThread.tsx', import.meta.url),
    {
      react: harness.react,
      '../../../common/components/CustomSelect': { CustomSelect: 'Select' },
      '../../../common/components/MarkdownEditor': { MarkdownEditor: 'Editor' },
      '../../../common/components/MarkdownPreview': { MarkdownPreview: 'Preview' },
      '../../../common/components/icons/Quote': { Quote: 'Quote' },
      '../../../common/utils/dateTime': { formatTime: () => 'Today', formatRelativeTime: () => 'just now' },
      '../../git/store/useGitStore': { useGitStore: () => ({ showToast: () => {} }) },
      '../store/useVirtualMrStore': {
        useVirtualMrStore: () => ({
          replyToDiscussion: async () => {},
          resolveDiscussion: async () => {},
          createDiscussion: async () => {},
        }),
      },
      '../utils/discussionReferences': {
        getDiscussionComments: (d) => (d.rootComment ? [d.rootComment, ...d.children] : d.children),
        parseDiscussionReference: () => null,
        buildDiscussionQuote: () => '',
        isResolvableDiscussion,
      },
      '../utils/discussionMentions': { getDiscussionMentionOptions: () => [] },
      '../../../common/utils/mentions': { parseMentionReference: () => null },
      './DiscussionReferenceDialog': { DiscussionReferenceDialog: 'Dialog' },
      './discussion/PendingDiscussionReply': { PendingDiscussionReply: 'PendingReply' },
    }
  );

  // 1. Render General Discussion Thread
  const renderedGeneral = await harness.render(DiscussionThread, {
    session,
    discussion: generalDiscussion,
  });
  const generalNodes = componentNodes(renderedGeneral);

  // General discussion must have "Reply..."
  const generalReplyBtn = generalNodes.find(
    (n) => n.props?.['aria-label'] === 'Reply to discussion disc_general'
  );
  assert.ok(generalReplyBtn, 'General discussion has a Reply button');

  // General discussion must NOT have Resolve button
  const generalResolveBtn = generalNodes.find(
    (n) =>
      typeof n.children === 'string' &&
      (n.children.includes('Resolve thread') || n.children.includes('Reopen thread'))
  );
  assert.equal(generalResolveBtn, undefined, 'General discussion does not have a Resolve thread button');

  // 2. Render Code Review Discussion Thread
  const renderedCode = await harness.render(DiscussionThread, {
    session,
    discussion: codeDiscussion,
  });
  const codeNodes = componentNodes(renderedCode);

  // Code discussion must have Resolve button
  const codeResolveBtn = codeNodes.find(
    (n) =>
      n.type === 'button' &&
      (n.props?.title?.includes('resolved') || n.props?.title?.includes('Reopen'))
  );
  assert.ok(codeResolveBtn, 'Code review discussion has a Resolve thread button');
});

test('MrDiscussionBoard and VirtualMrBottomBar only count unresolved code review discussions', async (t) => {
  const harness = componentHarness();

  const sessionWithBoth = {
    id: 'mr_test',
    title: 'Test MR',
    discussions: [
      // 1 general discussion (unresolved in data, but NOT a code review discussion)
      { id: 'gen_1', filePath: null, lineNumber: null, isResolved: false },
      // 1 code discussion resolved
      { id: 'code_resolved', filePath: 'src/main.rs', lineNumber: 10, isResolved: true },
      // 1 code discussion unresolved
      { id: 'code_open', filePath: 'src/lib.rs', lineNumber: 25, isResolved: false },
    ],
    reviewers: [],
    status: 'open',
    baseBranch: 'main',
    compareBranch: 'feature',
  };

  const { MrDiscussionBoard } = loadWithMocks(
    new URL('../frontend/features/virtual-mr/components/MrDiscussionBoard.tsx', import.meta.url),
    {
      react: harness.react,
      './DiscussionThread': { DiscussionThread: 'Thread' },
      '../utils/discussionResolvable': { isResolvableDiscussion },
    }
  );

  const renderedBoard = await harness.render(MrDiscussionBoard, { session: sessionWithBoth });
  const boardNodes = componentNodes(renderedBoard);

  const unresolvedLabel = boardNodes.find(
    (n) =>
      Array.isArray(n.props?.children) &&
      n.props.children.some((c) => typeof c === 'string' && c.includes('unresolved'))
  );
  assert.ok(unresolvedLabel);
  const text = unresolvedLabel.props.children.join('');
  assert.equal(text.trim(), '1 unresolved');
});
