/** Delivery scope, independent of the native window/webview representation. */
export type EventScope =
  | { kind: 'all' }
  | { kind: 'application' }
  | { kind: 'label'; label: string }
  | { kind: 'window' | 'webview' | 'webview-window'; label: string };
