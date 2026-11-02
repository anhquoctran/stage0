/** Respect reduced motion and keep successful persistence independent of animation support. */
export async function animateCommentRemoval(element: HTMLElement): Promise<void> {
  if (typeof element.animate !== 'function'
    || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  let animation: Animation | undefined;
  try {
    animation = element.animate([
      { opacity: 1, height: `${element.getBoundingClientRect().height}px`, overflow: 'hidden' },
      { opacity: 0, height: '0px', marginBlock: '0px', overflow: 'hidden', transform: 'translateY(-4px)' },
    ], { duration: 180, easing: 'ease-in', fill: 'forwards' });
    await animation.finished;
  } catch {
    // An unmount or unsupported WebView animation must not leave deleted content in state.
  } finally {
    animation?.cancel();
  }
}
