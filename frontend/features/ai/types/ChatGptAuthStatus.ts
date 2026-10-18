export interface ChatGptAuthStatus {
  connected: boolean;
  account_email?: string;
  error?: string;
  phase?: 'pending' | 'signed_in' | 'signed_out' | 'failed' | 'cancelled';
  attempt_id?: string | null;
  active_profile_id?: string | null;
  plan_usage_enabled?: boolean;
  profiles?: ChatGptProfile[];
  credentials_loaded?: boolean;
}
import type { ChatGptProfile } from './ChatGptProfile';
