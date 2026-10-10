export interface UnifiedAiChatResponse {
  success: boolean;
  content: string;
  duration_ms: number;
  provider_used: string;
  error?: string;
}
