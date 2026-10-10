export interface CopilotAuthStatus {
  connected: boolean;
  username?: string;
  avatar_url?: string;
  has_subscription: boolean;
  expires_at?: number;
  error?: string;
}
