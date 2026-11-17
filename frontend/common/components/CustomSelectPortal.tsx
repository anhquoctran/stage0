import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function CustomSelectPortal({ portal, render }: {
  portal: boolean;
  render: () => ReactNode;
}) {
  const content = render();
  if (!portal || typeof document === 'undefined') return content;
  return createPortal(content, document.body);
}
