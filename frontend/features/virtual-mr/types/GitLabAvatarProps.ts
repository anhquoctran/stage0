export interface GitLabAvatarProps {
  name: string;
  email?: string;
  avatarUrl?: string;
  isAiAgent?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

