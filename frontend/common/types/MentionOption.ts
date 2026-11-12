export interface MentionOption {
  id: string;
  label: string;
  kind: 'reviewer' | 'assignee' | 'mr' | 'commit';
  description?: string;
}
