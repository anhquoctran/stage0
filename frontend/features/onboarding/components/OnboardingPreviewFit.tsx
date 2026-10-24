import { useOnboardingPreviewFit } from '../hooks/useOnboardingPreviewFit';
import type { OnboardingPreviewFitProps } from '../types/OnboardingPreviewFitProps';

export function OnboardingPreviewFit({ children }: OnboardingPreviewFitProps) {
  const { viewportRef, contentRef, scale } = useOnboardingPreviewFit();
  return <div ref={viewportRef} data-onboarding-preview-viewport
    className="relative z-10 min-h-0 w-full flex-1 overflow-hidden rounded-sm">
    <div ref={contentRef} data-onboarding-preview-content
      className="absolute left-1/2 top-1/2 w-full max-w-2xl origin-center rounded-sm"
      style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
      <div className="stage0-onboarding-slide rounded-sm">{children}</div>
    </div>
  </div>;
}
