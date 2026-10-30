export interface PreferencesTransactionInput {
  patch: Record<string, unknown>;
  expectedRevision: string;
  apiKeys: Record<string, string>;
  apiKeyRemovals: string[];
  mcpEnvSecrets: Record<string, Record<string, string>>;
  mcpEnvRemovals: Record<string, string[]>;
}
