import { invoke, isTauri } from '../services/ipc/ipcClient';

/**
 * Opens a URL in the operating system's default web browser.
 * Uses Tauri IPC 'open_external_url' when running in desktop app,
 * falling back to window.open for web environments.
 */
export async function openUrl(url: string): Promise<void> {
  const trimmed = url.trim();
  if (!trimmed) return;

  if (isTauri()) {
    try {
      await invoke('open_external_url', { url: trimmed });
      return;
    } catch (err) {
      console.warn('Failed to open URL via open_external_url:', err);
    }
  }

  if (typeof window !== 'undefined') {
    window.open(trimmed, '_blank', 'noopener,noreferrer');
  }
}

/**
 * Initializes a document-level click listener to intercept external
 * http(s) and mailto link clicks in the webview, directing them
 * to the OS default browser instead of the webview window.
 */
export function initExternalLinkInterceptor(): void {
  if (typeof document === 'undefined') return;

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    const anchor = target?.closest('a');
    if (!anchor) return;

    const href = anchor.getAttribute('href');
    if (
      href &&
      (href.startsWith('http://') ||
        href.startsWith('https://') ||
        href.startsWith('mailto:'))
    ) {
      event.preventDefault();
      void openUrl(href);
    }
  });
}

