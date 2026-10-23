import { invoke, isTauri } from '@tauri-apps/api/core';
import { AI_PROVIDERS } from '../constants/aiPresets';
import type { AiConfig } from '../types/AiConfig';

function getLocalOllamaEndpoint(baseUrl: string): string | null {
  try {
    const url = new URL(baseUrl);
    const localHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      !localHosts.has(url.hostname.toLowerCase()) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return `${url.toString().replace(/\/+$/, '')}/api/tags`;
  } catch {
    return null;
  }
}

export async function checkAiProviderConnection(aiConfig: AiConfig, startTime: number) {
  // Live checks must report their actual transport/model result.
  if (aiConfig.provider === 'ollama') {
    const endpoint = getLocalOllamaEndpoint(aiConfig.baseUrl);
    if (!endpoint) {
      const res = {
        success: false,
        message:
          'Ollama checks are limited to localhost. Use an http(s) URL on localhost, 127.0.0.1, or ::1 without embedded credentials.',
        timestamp: Date.now(),
      };

      return res;
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const response = await fetch(endpoint, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const models = (data.models || []).map((m: { name: string }) => m.name);
        const latency = Date.now() - startTime;
        const res = {
          success: true,
          message: `Connected to Ollama daemon successfully (${latency}ms). Found ${models.length} local model(s). Active model: "${aiConfig.model}".`,
          timestamp: Date.now(),
        };

        return res;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (fetchErr: unknown) {
      const latency = Date.now() - startTime;
      const msg =
        fetchErr instanceof Error && fetchErr.name === 'AbortError'
          ? 'Ollama daemon connection timed out.'
          : 'Unable to connect to Ollama. Is the local Ollama service running?';
      const res = {
        success: false,
        message: `${msg} (${latency}ms)`,
        timestamp: Date.now(),
      };

      return res;
    }
  }

  if (isTauri()) {
    if (aiConfig.apiKey.trim()) {
      const res = {
        success: false,
        message:
          'Apply API key changes before testing. Native checks use only the credential saved in the OS key store, not an unsaved draft.',
        timestamp: Date.now(),
      };

      return res;
    }
    const result = await invoke<{ success: boolean; message: string }>('test_ai_review_provider', {
      request: {
        sessionId: 'connection-check',
        provider: aiConfig.provider,
        authMode: 'api_key',
        model: aiConfig.model,
        baseUrl: aiConfig.baseUrl,
        instructions: '',
        allowRemote: true,
        reasoningEffort: aiConfig.reasoningEffort || null,
        fastMode: aiConfig.fastMode === true,
      },
    });
    const res = { ...result, timestamp: Date.now() };

    return res;
  }

  // A regular browser cannot access the native key store or provider bridge.
  const providerName =
    AI_PROVIDERS.find((p) => p.id === aiConfig.provider)?.name || aiConfig.provider;

  const res = {
    success: false,
    message: `Live inference checks for ${providerName} are not available yet. No inference request was sent; credentials and model access have not been verified.`,
    timestamp: Date.now(),
  };

  return res;
}
