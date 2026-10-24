const SCROLLBAR_VISIBLE_ATTRIBUTE = 'data-stage0-scrollbar-visible';
const SCROLLBAR_IDLE_DELAY_MS = 700;
const idleTimers = new Map<Element, number>();

function revealScrollbarTemporarily(scrollElement: Element): void {
  scrollElement.setAttribute(SCROLLBAR_VISIBLE_ATTRIBUTE, '');
  const previousTimer = idleTimers.get(scrollElement);
  if (previousTimer !== undefined) window.clearTimeout(previousTimer);

  const timer = window.setTimeout(() => {
    scrollElement.removeAttribute(SCROLLBAR_VISIBLE_ATTRIBUTE);
    idleTimers.delete(scrollElement);
  }, SCROLLBAR_IDLE_DELAY_MS);
  idleTimers.set(scrollElement, timer);
}

export function installAutoHideScrollbars(): () => void {
  const showScrollbar = (event: Event) => {
    const target = event.target;
    const scrollElement = target instanceof Element
      ? target
      : target === document ? document.scrollingElement : null;
    if (!scrollElement) return;
    revealScrollbarTemporarily(scrollElement);
  };

  document.addEventListener('scroll', showScrollbar, { capture: true, passive: true });

  return () => {
    document.removeEventListener('scroll', showScrollbar, true);
    for (const [element, timer] of idleTimers) {
      window.clearTimeout(timer);
      element.removeAttribute(SCROLLBAR_VISIBLE_ATTRIBUTE);
    }
    idleTimers.clear();
  };
}
