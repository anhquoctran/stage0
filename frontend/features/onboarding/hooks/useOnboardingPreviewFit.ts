import { useLayoutEffect, useRef, useState } from 'react';

/** Measure untransformed content so scaling cannot feed back into its own size. */
export function useOnboardingPreviewFit() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    const fit = () => {
      const width = viewport.clientWidth;
      const height = viewport.clientHeight;
      const naturalWidth = Math.max(content.offsetWidth, content.scrollWidth);
      const naturalHeight = Math.max(content.offsetHeight, content.scrollHeight);
      // The desktop preview is hidden on narrow windows; observe it becoming visible.
      if (width <= 0 || height <= 0 || naturalWidth <= 0 || naturalHeight <= 0) return;
      setScale(Math.min(1, width / naturalWidth, height / naturalHeight));
    };
    fit();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    observer?.observe(viewport);
    observer?.observe(content);
    window.addEventListener('resize', fit);
    return () => { observer?.disconnect(); window.removeEventListener('resize', fit); };
  }, []);

  return { viewportRef, contentRef, scale };
}
