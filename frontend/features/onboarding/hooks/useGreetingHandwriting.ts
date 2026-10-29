import { useLayoutEffect, type RefObject } from 'react';
import type { AppLanguage } from '../../i18n/types/AppLanguage';
import { handwritingKeyframes } from '../utils/handwritingKeyframes';

/** Animate actual pen paths together and clean up on locale/motion changes. */
export function useGreetingHandwriting(svg: RefObject<SVGSVGElement | null>, language: AppLanguage) {
  useLayoutEffect(() => {
    const element = svg.current;
    if (!element) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const paths = [...element.querySelectorAll<SVGPathElement>('[data-handwriting-stroke]')];
    let animations: Animation[] = [];
    const cancel = () => {
      animations.forEach((animation) => animation.cancel());
      animations = [];
    };
    const play = () => {
      cancel();
      if (motion.matches || paths.some((path) => typeof path.animate !== 'function')) return;
      const frames = handwritingKeyframes(paths.map((path) => path.getTotalLength()));
      animations = paths.map((path, index) => path.animate(frames[index], {
        duration: 7000,
        iterations: Infinity,
        easing: 'linear',
      }));
      // All pen strokes share one epoch; they restart and fade as one word.
      const epoch = document.timeline.currentTime;
      if (epoch !== null) animations.forEach((animation) => { animation.startTime = epoch; });
    };
    play();
    motion.addEventListener('change', play);
    return () => {
      motion.removeEventListener('change', play);
      cancel();
    };
  }, [svg, language]);
}
