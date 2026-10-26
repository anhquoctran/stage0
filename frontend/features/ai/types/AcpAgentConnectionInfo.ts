export interface AcpAgentConnectionInfo {
  authMethods: Array<{
    id: string;
    name?: string;
    description?: string;
    type?: string;
  }>;
  authStatus: {
    kind: string;
    label: string;
    detail?: string;
    account?: {
      email?: string;
      organization?: string;
      plan?: string;
    };
  } | null;
  supportsAuthStatus: boolean;
  supportsAuthLogout: boolean;
  agentInfo: {
    name?: string;
    title?: string;
    version?: string;
  } | null;
}
