import type { RequestOptions } from './RequestOptions';
import type { RequestPayload } from './RequestPayload';

/** Infrastructure port; feature services own command names and wire payloads. */
export interface CommandTransport {
  executeCommand<T>(operation: string, input?: RequestPayload, options?: RequestOptions): Promise<T>;
  executeWithProgress<T, P>(
    operation: string,
    input: Record<string, unknown>,
    onProgress: (progress: P) => void,
    options?: RequestOptions,
  ): Promise<T>;
}
