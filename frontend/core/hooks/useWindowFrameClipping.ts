import { useLayoutEffect } from 'react';

/** Clip the entire WebView, including dialogs portaled outside the app frame. */
export function useWindowFrameClipping(rounded: boolean) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const previous = root.getAttribute('data-window-rounded');
    root.setAttribute('data-window-rounded', String(rounded));
    return () => {
      if (previous === null) root.removeAttribute('data-window-rounded');
      else root.setAttribute('data-window-rounded', previous);
    };
  }, [rounded]);
}
