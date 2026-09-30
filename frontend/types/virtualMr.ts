export type VirtualMrStatus = 'open' | 'approved' | 'closed';
export type ReviewActionType = 'comment' | 'approve' | 'request_changes';
export type ReviewerState = 'pending' | 'reviewing' | 'approved' | 'changes_requested' | 'commented';
export type AuthorType = 'user' | 'ai_agent';
export type ResolveType = 'manual' | 'ai_verified';
export type VerificationStatus = 'none' | 'verifying' | 'pass' | 'fail';

export interface RepoLabel {
  id: string;
  repoId: string;
  name: string;
  color: string;
  description?: string;
}

export interface VirtualMrComment {
  id: string;
  discussionId: string;
  authorType: AuthorType;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  body: string; // Markdown format
  reviewAction?: ReviewActionType;
  createdAt: string;
  updatedAt: string;
}

export interface VirtualMrDiscussion {
  id: string;
  sessionId: string;
  filePath?: string | null;
  diffSide?: 'left' | 'right' | null;
  lineNumber?: number | null;
  commitId?: string | null;
  isResolved: boolean;
  resolveType?: ResolveType;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  verificationStatus?: VerificationStatus;
  verifiedByBot?: string | null;
  verifiedAt?: string | null;
  comments: VirtualMrComment[];
  createdAt: string;
}

export interface VirtualMrReviewer {
  agentId: string;
  agentName: string;
  reviewStatus: ReviewerState;
  assignedAt: string;
}

export interface VirtualMrCommit {
  hash: string;
  shortHash: string;
  subject: string;
  body?: string;
  authorName: string;
  authorEmail: string;
  authoredDate: string;
}

export interface VirtualMrSession {
  id: string;
  repoId: string;
  title: string;
  description: string; // Markdown description
  baseBranch: string;
  compareBranch: string;
  status: VirtualMrStatus;
  assignee: {
    name: string;
    email: string;
    avatarUrl?: string;
  };
  reviewers: VirtualMrReviewer[];
  labels: RepoLabel[];
  discussions: VirtualMrDiscussion[];
  commits: VirtualMrCommit[];
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NewMrDraft {
  baseBranch: string;
  compareBranch: string;
  title: string;
  description: string;
  selectedBots: string[];
  selectedLabels: string[];
  commits: VirtualMrCommit[];
  isCommitsLoading: boolean;
}

export interface RepoSettings {
  repoId: string;
  defaultBaseBranch: string;
  inheritGlobalAgents: boolean;
  customAgentRules?: string;
  activeAgentIds: string[];
}

export interface GitRemoteDetail {
  name: string;
  fetch_url: string;
  push_url: string;
}

export interface GitTagInfo {
  name: string;
  commit_hash: string;
  message?: string | null;
  date?: string | null;
}

export interface AiReviewerBotMeta {
  id: string;
  name: string;
  tagline: string;
  category: 'security' | 'performance' | 'style' | 'architecture';
  avatarEmoji: string;
  description: string;
  defaultRules: string;
}

export const AVAILABLE_AI_BOTS: AiReviewerBotMeta[] = [
  {
    id: 'security-bot',
    name: 'Security Auditor Bot',
    tagline: 'OWASP & Secret Leak Detection',
    category: 'security',
    avatarEmoji: '🛡️',
    description: 'Specializes in scanning for vulnerabilities, API token leaks, secret keys, and input validation.',
    defaultRules: 'Strictly check for hardcoded secrets, sanitization, token leaks, injection flaws, and critical security risks.',
  },
  {
    id: 'codestyle-bot',
    name: 'Code Style & Quality Bot',
    tagline: 'Naming, Clean Code & Lints',
    category: 'style',
    avatarEmoji: '✨',
    description: 'Detects code smells, unused variables, inconsistent conventions, and formatting flaws.',
    defaultRules: 'Adhere to clean code practices, meaningful variable names, duplicate avoidance, and strict type safety.',
  },
  {
    id: 'performance-bot',
    name: 'Performance & Memory Bot',
    tagline: 'Big-O, Allocation & N+1 Queries',
    category: 'performance',
    avatarEmoji: '⚡',
    description: 'Analyzes algorithmic complexity, redundant memory allocations, and inefficient loops.',
    defaultRules: 'Focus on runtime performance, avoid unnecessary memory clones, optimize loops and blocking operations.',
  },
  {
    id: 'arch-bot',
    name: 'Architecture Reviewer Bot',
    tagline: 'SOLID, Modularity & Breaking Changes',
    category: 'architecture',
    avatarEmoji: '🏛️',
    description: 'Evaluates modularity, clean/hexagonal architecture patterns, and prevents breaking API changes.',
    defaultRules: 'Ensure loose coupling between layers, uphold SOLID principles, and preserve backward compatibility.',
  },
];

export const PRESET_REPO_LABELS: Omit<RepoLabel, 'id' | 'repoId'>[] = [
  { name: 'feature', color: '#3b82f6', description: 'New feature or enhancement' },
  { name: 'bugfix', color: '#ef4444', description: 'Bug fix or error resolution' },
  { name: 'refactor', color: '#8b5cf6', description: 'Code refactoring without behavioral changes' },
  { name: 'security', color: '#f59e0b', description: 'Security patch or vulnerability fix' },
  { name: 'performance', color: '#10b981', description: 'Performance and memory optimization' },
  { name: 'documentation', color: '#06b6d4', description: 'Documentation additions or improvements' },
  { name: 'needs-review', color: '#ec4899', description: 'Awaiting reviewer feedback' },
  { name: 'ai-approved', color: '#22c55e', description: 'Approved by AI Reviewer bots' },
  { name: 'changes-requested', color: '#f97316', description: 'Changes requested before merge' },
];
