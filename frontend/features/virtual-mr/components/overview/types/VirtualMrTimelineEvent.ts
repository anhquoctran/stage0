import React from 'react';
import type { VirtualMrDiscussion } from '../../../types/VirtualMrDiscussion';

export interface VirtualMrTimelineEvent {
  id: string;
  type: 'created' | 'label' | 'assignee' | 'reviewer' | 'commit' | 'title' | 'description' | 'discussion';
  author: string;
  timestamp: string;
  discussion?: VirtualMrDiscussion;
  render: () => React.ReactNode;
}

