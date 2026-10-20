export type VirtualMrSessionSaveOutcome =
  | { outcome: 'saved' }
  | {
      outcome: 'duplicate_open';
      existing_id: string;
      existing_title: string;
      base_branch: string;
      compare_branch: string;
    };
