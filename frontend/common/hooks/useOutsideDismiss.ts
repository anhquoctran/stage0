import { useEffect, useRef, type RefObject } from 'react';

/** Dismiss a dropdown without swallowing the outside control's own interaction. */
export function useOutsideDismiss(
  containerRef: RefObject<HTMLElement | null>,
  isOpen: boolean,
  onDismiss: () => void,
) {
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    if (!isOpen) return;
    const ownerDocument = containerRef.current?.ownerDocument ?? document;
    const handleOutside = (event: Event) => {
      const container = containerRef.current;
      if (!container) return;
      // composedPath also recognizes interactions retargeted across a shadow root.
      if (event.composedPath().includes(container) || container.contains(event.target as Node)) return;
      dismissRef.current();
    };

    // Capture survives stopPropagation in dialogs. Pointer events cover touch/pen;
    // click also covers keyboard/assistive activation without a pointer event.
    ownerDocument.addEventListener('pointerdown', handleOutside, true);
    ownerDocument.addEventListener('click', handleOutside, true);
    ownerDocument.addEventListener('focusin', handleOutside, true);
    return () => {
      ownerDocument.removeEventListener('pointerdown', handleOutside, true);
      ownerDocument.removeEventListener('click', handleOutside, true);
      ownerDocument.removeEventListener('focusin', handleOutside, true);
    };
  }, [containerRef, isOpen]);
}
