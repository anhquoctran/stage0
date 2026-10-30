export const WELCOME_SLIDES = [
  {
    id: 'hello',
    stepLabel: 'onboarding.hello.languageLabel',
    eyebrow: '',
    title: 'onboarding.hello.title',
    description: 'onboarding.hello.description',
    caption: '',
  },
  {
    id: 'welcome',
    stepLabel: 'onboarding.welcomeSlides.workspaceStep',
    eyebrow: 'onboarding.welcomeSlides.workspaceEyebrow',
    title: 'onboarding.welcomeSlides.workspaceTitle',
    description: 'onboarding.welcomeSlides.workspaceDescription',
    caption: 'onboarding.welcomeSlides.workspaceCaption',
    highlights: [
      {
        title: 'onboarding.welcomeSlides.compareHighlightTitle',
        description: 'onboarding.welcomeSlides.compareHighlightDescription',
      },
      {
        title: 'onboarding.welcomeSlides.localMrsHighlightTitle',
        description: 'onboarding.welcomeSlides.localMrsHighlightDescription',
      },
    ],
  },
  {
    id: 'ai-setup',
    stepLabel: 'onboarding.welcomeSlides.aiStep',
    eyebrow: 'onboarding.welcomeSlides.aiEyebrow',
    title: 'onboarding.welcomeSlides.aiTitle',
    description: 'onboarding.welcomeSlides.aiDescription',
    caption: 'onboarding.welcomeSlides.aiCaption',
  },
  {
    id: 'reviewer-setup',
    stepLabel: 'onboarding.welcomeSlides.reviewerStep',
    eyebrow: 'onboarding.welcomeSlides.reviewerEyebrow',
    title: 'onboarding.welcomeSlides.reviewerTitle',
    description: 'onboarding.welcomeSlides.reviewerDescription',
    caption: 'onboarding.welcomeSlides.reviewerCaption',
  },
  {
    id: 'repository',
    stepLabel: 'onboarding.welcomeSlides.readyStep',
    eyebrow: 'onboarding.welcomeSlides.readyEyebrow',
    title: 'onboarding.welcomeSlides.readyTitle',
    description: 'onboarding.welcomeSlides.readyDescription',
    caption: 'onboarding.welcomeSlides.readyCaption',
  },
] as const;
