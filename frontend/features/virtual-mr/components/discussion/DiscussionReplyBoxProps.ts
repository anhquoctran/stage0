import React from 'react';
import type { VirtualMrComment } from '../../types/VirtualMrComment';
import type { VirtualMrDiscussion } from '../../types/VirtualMrDiscussion';
import type { VirtualMrSession } from '../../types/VirtualMrSession';

export interface DiscussionReplyBoxProps {
  isReplying: boolean;
  targetId: string;
  setTargetId: React.Dispatch<React.SetStateAction<string>>;
  isSubmitting: boolean;
  discussion: VirtualMrDiscussion;
  rootComment: VirtualMrComment;
  session: VirtualMrSession;
  body: string;
  setBody: React.Dispatch<React.SetStateAction<string>>;
  submit: (andResolve?: boolean) => Promise<void>;
  resolveThread: boolean;
  isResolvable: boolean;
  setResolveThread: React.Dispatch<React.SetStateAction<boolean>>;
  setIsReplying: React.Dispatch<React.SetStateAction<boolean>>;
  setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  handleToggleResolve: () => Promise<void>;
}
