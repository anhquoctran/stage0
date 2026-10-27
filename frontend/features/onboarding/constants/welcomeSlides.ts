export const WELCOME_SLIDES = [
  {
    id: 'welcome',
    stepLabel: 'Workspace',
    eyebrow: 'WELCOME TO STAGE0',
    title: 'Welcome to Stage0',
    description:
      'Compare branches, spot merge conflicts in memory, and keep local Virtual MR reviews organized without touching your working tree.',
    caption:
      'System theme and Stage0 shortcuts are selected by default. You can customize fonts and more anytime in Preferences.',
    highlights: [
      {
        title: 'Compare without checkout',
        description:
          'Inspect diffs and likely merge conflicts between any two branches while keeping your working copy clean.',
      },
      {
        title: 'Local Virtual MRs',
        description:
          'Keep descriptions, labels, inline comments, and AI review runs together on your machine.',
      },
    ],
  },
  {
    id: 'ai-setup',
    stepLabel: 'AI Connection',
    eyebrow: 'REQUIRED STEP 1 OF 2',
    title: 'Set up your AI connection',
    description:
      'Connect an LLM provider or install an ACP agent. Your connection is saved automatically.',
    caption:
      'API keys are stored in your OS keychain. Saving a connection does not send repository code or start a review.',
  },
  {
    id: 'reviewer-setup',
    stepLabel: 'Reviewer Bot',
    eyebrow: 'REQUIRED STEP 2 OF 2',
    title: 'Create your first reviewer bot',
    description:
      'Create an enabled custom reviewer bot powered by your AI connection to unlock code reviews.',
    caption:
      'You can add more specialized reviewer bots or customize instructions later in AI Preferences.',
  },
  {
    id: 'repository',
    stepLabel: 'Ready',
    eyebrow: 'YOUR WORKSPACE IS READY',
    title: 'Start with a repository',
    description:
      'Configure system startup options, then open a local Git project or clone a remote repository to begin your first review.',
    caption: 'Your appearance, keymap, and startup choices are saved when you continue.',
  },
] as const;
