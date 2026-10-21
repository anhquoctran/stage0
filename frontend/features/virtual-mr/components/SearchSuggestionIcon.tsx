import React from 'react';
import { User } from '../../../common/components/icons/User';
import { GitPullRequest } from '../../../common/components/icons/GitPullRequest';
import { Tag } from '../../../common/components/icons/Tag';
import { GitBranch } from '../../../common/components/icons/GitBranch';
import { CheckCircle2 } from '../../../common/components/icons/CheckCircle2';
import { MessageSquare } from '../../../common/components/icons/MessageSquare';
import { Search } from '../../../common/components/icons/Search';
import type { VirtualMrSearchSuggestion } from '../types/VirtualMrSearchSuggestion';

export const SearchSuggestionIcon: React.FC<{ field: VirtualMrSearchSuggestion['field'] }> = ({ field }) => {
  if (field === 'author' || field === 'assignee') return <User className="h-3.5 w-3.5" />;
  if (field === 'reviewer' || field === 'approved-by') return <GitPullRequest className="h-3.5 w-3.5" />;
  if (field === 'label') return <Tag className="h-3.5 w-3.5" />;
  if (field === 'base' || field === 'head') return <GitBranch className="h-3.5 w-3.5" />;
  if (field === 'is') return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (field === 'has' || field === 'no') return <MessageSquare className="h-3.5 w-3.5" />;
  return <Search className="h-3.5 w-3.5" />;
};

