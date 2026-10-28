import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { menuPopupPosition } from './menuPopupPosition';

export function useMenuPopupPosition(open: boolean, submenu: boolean, rtl: boolean) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<ReturnType<typeof menuPopupPosition> | null>(null);
  useEffect(() => {
    if (!open || typeof window === 'undefined') { setPosition(null); return; }
    const update = () => {
      if (!anchorRef.current || !popupRef.current) return;
      const next = menuPopupPosition(anchorRef.current.getBoundingClientRect(),
        { width: popupRef.current.offsetWidth, height: popupRef.current.scrollHeight },
        { width: window.innerWidth, height: window.innerHeight }, submenu, rtl);
      setPosition((previous) => previous?.left === next.left && previous.top === next.top && previous.maxHeight === next.maxHeight ? previous : next);
    };
    update();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : undefined;
    if (anchorRef.current) observer?.observe(anchorRef.current);
    if (popupRef.current) observer?.observe(popupRef.current);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, submenu, rtl]);
  const popupStyle: CSSProperties = {
    position: 'fixed', left: position?.left ?? 0, top: position?.top ?? 0,
    maxHeight: position?.maxHeight, minWidth: 'min(16rem, calc(100vw - 8px))',
    maxWidth: 'calc(100vw - 8px)', overflowY: 'auto',
    visibility: position ? 'visible' : 'hidden',
  };
  return { anchorRef, popupRef, popupStyle };
}
