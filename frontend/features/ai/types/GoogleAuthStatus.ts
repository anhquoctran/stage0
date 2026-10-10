export interface GoogleAuthStatus {
  connected: boolean;
  account_email?: string;
  auth_method: string;
  error?: string;
}
