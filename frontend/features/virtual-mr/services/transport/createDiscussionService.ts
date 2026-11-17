import type { CommandTransport } from '../../../../common/services/ipc/contracts/CommandTransport';
import type { DiscussionService } from './DiscussionService';

export function createDiscussionService(transport: CommandTransport): DiscussionService {
  return {
    listMrDeletionActivity: (input) => transport.executeCommand('list_mr_deletion_activity', input),
    listMrDiscussionActivity: (input) => transport.executeCommand('list_mr_discussion_activity', input),
    deleteMrComment: (input) => transport.executeCommand('delete_mr_comment', input),
    addMrComment: (input) => transport.executeCommand('add_mr_comment', input),
    createMrDiscussion: (input) => transport.executeCommand('create_mr_discussion', input),
    listMrDiscussions: (input) => transport.executeCommand('list_mr_discussions', input),
    resolveMrDiscussion: (input) => transport.executeCommand('resolve_mr_discussion', input),
  };
}
