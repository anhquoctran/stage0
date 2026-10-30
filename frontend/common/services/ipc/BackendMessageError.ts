import { formatBackendMessage, parseBackendMessage } from './backendMessages';

/** Translation is resolved on access so retained errors follow language changes. */
export class BackendMessageError extends Error {
  readonly code: string;
  readonly params: Record<string, string | number | boolean>;
  readonly diagnostic?: string;

  constructor(wire: string) {
    super();
    this.name = 'BackendMessageError';
    const message = parseBackendMessage(wire);
    this.code = message?.code ?? 'backend.errors.operation';
    this.params = message?.params ?? {};
    this.diagnostic = message?.diagnostic;
    Object.defineProperty(this, 'message', { get: () => formatBackendMessage(wire), configurable: true });
  }
}
