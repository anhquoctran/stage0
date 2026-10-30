const prefix = 'stage0-message:';
let translate: (code: string, params: Record<string, string | number | boolean>) => string = (code) => code;

/** Installed by application localization; infrastructure never imports a feature. */
export function configureBackendMessages(translator: typeof translate): void {
  translate = translator;
}

export function parseBackendMessage(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith(prefix)) return null;
  try {
    const message = JSON.parse(value.slice(prefix.length)) as Record<string, unknown>;
    if (typeof message.code !== 'string' || !/^backend\.[a-zA-Z0-9_.]+$/.test(message.code)) return null;
    if (!message.params || typeof message.params !== 'object' || Array.isArray(message.params)) return null;
    if (Object.values(message.params).some((param) => !['string', 'number', 'boolean'].includes(typeof param))) return null;
    return {
      code: message.code,
      params: message.params as Record<string, string | number | boolean>,
      diagnostic: typeof message.diagnostic === 'string' ? message.diagnostic : undefined,
    };
  } catch { return null; }
}

export function formatBackendMessage(value: string): string {
  const message = parseBackendMessage(value);
  return message ? translate(message.code, message.params) : value;
}

/** Only application-owned message slots are decoded. Source, commits, settings,
 * model output and user-authored Markdown remain byte-for-byte unchanged. */
export function localizeBackendPayload<T>(value: T): T {
  if (typeof value === 'string') return formatBackendMessage(value) as T;
  if (Array.isArray(value)) {
    const decoded = value.map(localizeBackendPayload);
    return decoded.every((item, index) => item === value[index]) ? value : decoded as T;
  }
  if (value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const record = value as Record<string, unknown>;
    const statusMessage = ('currentVersion' in record && 'supported' in record)
      || 'attachedToHarness' in record || 'status_message' in record || 'conflict_type' in record
      || ('rule' in record && 'severity' in record);
    const protectedFields = new Set(['settings', 'content', 'description', 'generatedDescription', 'summary', 'notes', 'body', 'codeSnippet', 'params']);
    const entries = Object.entries(record).map(([key, item]) => {
      if (protectedFields.has(key)) return [key, item];
      if (typeof item === 'string') {
        const isMessage = ['error', 'error_message', 'errorMessage', 'validationError', 'validation_error', 'status_message'].includes(key)
          || (key === 'message' && statusMessage);
        return [key, isMessage ? formatBackendMessage(item) : item];
      }
      return [key, localizeBackendPayload(item)];
    });
    return entries.every(([key, item]) => record[key as string] === item) ? value : Object.fromEntries(entries) as T;
  }
  return value;
}
