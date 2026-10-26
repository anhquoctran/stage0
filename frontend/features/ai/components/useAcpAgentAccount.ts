import { useApplicationServices } from '../../../core/services/runtime/useApplicationServices';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AcpAgentConfig } from '../types/AcpAgentConfig';
import type { AcpAgentConnectionInfo } from '../types/AcpAgentConnectionInfo';
import type { AuthMethod } from '../types/AuthMethod';
import { saveLastSuccessfulSignIn, type AcpLastSuccessfulSignIn } from '../utils/acpAuthHistory';
import type { AcpAgentAccountContext } from './AcpAgentAccountContext';

function preferredAuthMethod(methods: AuthMethod[], authStatus: AcpAgentConnectionInfo['authStatus']) {
  const accountLabel = `${authStatus?.kind || ''} ${authStatus?.label || ''}`;
  if (/api[\s-]*key/i.test(accountLabel)) {
    const apiKeyMethod = methods.find((method) => method.id === 'api-key');
    if (apiKeyMethod) return apiKeyMethod.id;
  }
  const chatGptMethod = methods.find((method) =>
    /chat\s*-?gpt/i.test(`${method.name || ''} ${method.id}`)
  );
  const currentMethod = /chat\s*-?gpt/i.test(accountLabel) ? chatGptMethod : undefined;
  return currentMethod?.id || chatGptMethod?.id || methods[0]?.id || '';
}

export function useAcpAgentAccount({
  setError,
  detailAgent,
  setBusyId,
  setNotice,
}: AcpAgentAccountContext) {
  const appServices = useApplicationServices();
  const [authMethods, setAuthMethods] = useState<AuthMethod[]>([]);

  const [authStatus, setAuthStatus] = useState<AcpAgentConnectionInfo['authStatus']>(null);

  const [supportsAuthStatus, setSupportsAuthStatus] = useState(false);

  const [supportsAuthLogout, setSupportsAuthLogout] = useState(false);

  const [reportedAgentInfo, setReportedAgentInfo] =
    useState<AcpAgentConnectionInfo['agentInfo']>(null);

  const [selectedAuthMethod, setSelectedAuthMethod] = useState('');

  const [isCheckingAuth, setIsCheckingAuth] = useState(false);

  const [lastSuccessfulSignIn, setLastSuccessfulSignIn] = useState<AcpLastSuccessfulSignIn | null>(
    null
  );

  const connectionRequestRef = useRef(0);

  const applyConnectionInfo = useCallback((info: AcpAgentConnectionInfo) => {
    setAuthMethods(info.authMethods);
    setSelectedAuthMethod(preferredAuthMethod(info.authMethods, info.authStatus));
    setAuthStatus(info.authStatus);
    setSupportsAuthStatus(info.supportsAuthStatus);
    setSupportsAuthLogout(info.supportsAuthLogout);
    setReportedAgentInfo(info.agentInfo);
  }, []);

  const refreshAgentConnection = useCallback(
    async (agent: AcpAgentConfig): Promise<AcpAgentConnectionInfo | null> => {
      const requestId = ++connectionRequestRef.current;
      setIsCheckingAuth(true);
      setError(null);
      try {
        const info = await appServices.externalAgents.acpAgentConnectionInfo({
          config: agent,
        });
        if (requestId === connectionRequestRef.current) applyConnectionInfo(info);
        return requestId === connectionRequestRef.current ? info : null;
      } catch (cause) {
        if (requestId === connectionRequestRef.current) {
          setAuthMethods([]);
          setAuthStatus(null);
          setSupportsAuthStatus(false);
          setSupportsAuthLogout(false);
          setReportedAgentInfo(null);
          setError(`Could not check this agent's account status: ${String(cause)}`);
        }
        return null;
      } finally {
        if (requestId === connectionRequestRef.current) setIsCheckingAuth(false);
      }
    },
    [applyConnectionInfo]
  );

  useEffect(() => {
    if (!detailAgent) return;
    setAuthMethods([]);
    setAuthStatus(null);
    setSupportsAuthStatus(false);
    setSupportsAuthLogout(false);
    setReportedAgentInfo(null);
    if (appServices.platform.capabilities.externalAgents) void refreshAgentConnection(detailAgent);
    return () => {
      connectionRequestRef.current += 1;
    };
  }, [detailAgent, refreshAgentConnection]);

  const signIn = async () => {
    if (!detailAgent || !selectedAuthMethod) return;
    setBusyId(detailAgent.id);
    setError(null);
    try {
      const method = authMethods.find((item) => item.id === selectedAuthMethod);
      const isGoogleSignIn = /google/i.test(
        `${method?.name || ''} ${method?.id || selectedAuthMethod}`
      );
      const shouldLogoutFirst = supportsAuthLogout && authStatus?.kind !== 'none';
      setNotice(
        shouldLogoutFirst
          ? 'Signing out of the current agent account before starting a new sign-in…'
          : isGoogleSignIn
          ? 'Starting Google sign-in. Antigravity should open your default browser if a new login is needed…'
          : 'Starting the agent sign-in flow…'
      );
      if (shouldLogoutFirst) {
        await appServices.externalAgents.acpAgentLogout({ config: detailAgent });
        setAuthStatus(null);
      }
      const result = await appServices.externalAgents.acpAgentAuthenticate({ config: detailAgent, methodId: selectedAuthMethod });
      const completed: AcpLastSuccessfulSignIn = {
        completedAt: new Date().toISOString(),
        methodId: selectedAuthMethod,
        methodLabel: method?.name || selectedAuthMethod,
        agentVersion: detailAgent.version,
      };
      setLastSuccessfulSignIn(completed);
      const saved = saveLastSuccessfulSignIn(detailAgent, completed);
      setNotice('Sign-in completed. Refreshing the agent-reported account status…');
      const refreshed = await refreshAgentConnection(detailAgent);
      const reportedStatus = refreshed?.authStatus ?? result?.authStatus ?? null;
      if (reportedStatus) setAuthStatus(reportedStatus);
      setNotice(
        reportedStatus
          ? 'Sign-in completed. The account details shown here are reported by the agent.'
          : saved
            ? 'Sign-in completed. This agent does not provide account details over ACP; Stage0 saved the sign-in result on this device.'
            : 'Sign-in completed, but Stage0 could not save the local sign-in confirmation. This agent does not provide account details over ACP.'
      );
    } catch (cause) {
      setError(String(cause));
    } finally {
      setBusyId(null);
    }
  };

  const selectedAuthOption = authMethods.find((method) => method.id === selectedAuthMethod);

  return {
    setAuthMethods,
    setAuthStatus,
    setSupportsAuthStatus,
    setReportedAgentInfo,
    setSelectedAuthMethod,
    setLastSuccessfulSignIn,
    setIsCheckingAuth,
    reportedAgentInfo,
    authStatus,
    lastSuccessfulSignIn,
    isCheckingAuth,
    supportsAuthStatus,
    supportsAuthLogout,
    authMethods,
    selectedAuthMethod,
    selectedAuthOption,
    signIn,
  };
}
