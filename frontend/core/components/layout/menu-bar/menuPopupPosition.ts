/** Keep custom menus inside the webview, including nested menus at the right edge. */
export function menuPopupPosition(
  anchor: { left: number; right: number; top: number; bottom: number },
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  submenu: boolean,
  rtl: boolean,
) {
  const margin = 4;
  const width = Math.min(size.width, Math.max(0, viewport.width - margin * 2));
  const height = Math.min(size.height, Math.max(0, viewport.height - margin * 2));
  let left = submenu
    ? (rtl ? anchor.left - width : anchor.right)
    : (rtl ? anchor.right - width : anchor.left);
  if (submenu && !rtl && left + width > viewport.width - margin) left = anchor.left - width;
  if (submenu && rtl && left < margin) left = anchor.right;
  left = Math.max(margin, Math.min(left, viewport.width - width - margin));
  let top = submenu ? anchor.top : anchor.bottom + 2;
  if (!submenu && top + height > viewport.height - margin && anchor.top - height - 2 >= margin)
    top = anchor.top - height - 2;
  top = Math.max(margin, Math.min(top, viewport.height - height - margin));
  return { left, top, maxHeight: Math.max(0, viewport.height - top - margin) };
}
