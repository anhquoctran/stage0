import { useEffect } from 'react';

// Escape follows the same discard/single-flight path as the Cancel button.
export function usePreferencesDismiss({
  isOpen,
  hasChildDialog,
  onCancel,
}: {
  isOpen: boolean;
  hasChildDialog: boolean;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!isOpen || hasChildDialog || typeof window === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return;
      event.preventDefault();
      onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, hasChildDialog, onCancel]);
}
