import type { CommandTransport } from '../../../../common/services/ipc/contracts/CommandTransport';
import type { GitHistoryService } from './GitHistoryService';

export function createGitHistoryService(transport: CommandTransport): GitHistoryService {
  return {
    getGitCommitDetails: (input) => transport.executeCommand('get_git_commit_details', input),
    checkMergeConflicts: (input) => transport.executeCommand('check_merge_conflicts', input),
    getCommitsBetweenRefs: (input) => transport.executeCommand('get_commits_between_refs', input),
    getConflictedFilePreview: (input) => transport.executeCommand('get_conflicted_file_preview', input),
    getCurrentBranchGraph: (input) => transport.executeCommand('get_current_branch_graph', input),
    getFileBlame: (input) => transport.executeCommand('get_file_blame', input),
    getGitCommitMessage: (input) => transport.executeCommand('get_git_commit_message', input),
    getGitRefSha: (input) => transport.executeCommand('get_git_ref_sha', input),
    getGitUserIdentityCmd: (input) => transport.executeCommand('get_git_user_identity_cmd', input),
    getMrDiff: (input) => transport.executeCommand('get_mr_diff', input),
    searchGitCommitMessages: (input) => transport.executeCommand('search_git_commit_messages', input),
  };
}
