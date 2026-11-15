export interface MentionOption {
  id: string;
  label: string;
  kind: 'reviewer' | 'assignee' | 'mr' | 'commit';
  description?: string;
  /** Text persisted in the link when it differs from the suggestion label. */
  insertLabel?: string;
}
