export interface ChatGptDeviceAuthStatus {
  attemptId: string;
  phase: 'idle' | 'starting' | 'pending' | 'checking' | 'signed_in' | 'signed_out' | 'cancelling' | 'cancelled' | 'signing_out' | 'failed';
  userCode: string | null;
  verificationUrl: string | null;
  accountEmail: string | null;
  planType: string | null;
  deadlineAt: string | null;
  error: string | null;
}
