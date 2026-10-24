export const WELCOME_SLIDES = [
  {
    id: 'welcome', eyebrow: 'A FRIENDLIER WAY TO REVIEW', title: 'Welcome to Stage0',
    description: 'Understand what a branch will bring into your project before you merge it. Stage0 gives you a clear place to compare, inspect, and review.',
    caption: 'Start with two branches. Keep your working copy right where it is.',
  },
  {
    id: 'compare', eyebrow: 'COMPARE WITH CONFIDENCE', title: 'Know what will change',
    description: 'Choose a base branch and a branch to compare. Review changed files and likely merge conflicts before deciding what to do next.',
    caption: 'Reviewing does not check out or merge branches into your working tree or Git index.',
  },
  {
    id: 'review', eyebrow: 'YOUR REVIEW, READY WHEN YOU ARE', title: 'Keep the conversation together',
    description: 'Save a local Virtual MR with its description, labels, comments, and review notes. Come back to the same review whenever you need it.',
    caption: 'Next, make Stage0 feel familiar with your own shortcuts and fonts.',
  },
  {
    id: 'keymaps', eyebrow: 'FAMILIAR SHORTCUTS', title: 'Choose your keymap',
    description: 'Start with the shortcuts of your favorite editor or Git app.',
    caption: 'Presets adapt equivalent Stage0 actions. Custom bindings are preserved; you can fine-tune them in Preferences.',
  },
  {
    id: 'ui-font', eyebrow: 'YOUR INTERFACE', title: 'Choose your UI font',
    description: 'Give menus, navigation, labels, and buttons a familiar look.',
    caption: 'Preview changes instantly. Your choices are saved when you finish or skip the guide.',
  },
  {
    id: 'buffer-font', eyebrow: 'COMFORTABLE CODE READING', title: 'Tune your buffer font',
    description: 'Choose how code appears in diff viewers and editor panes.',
    caption: 'Use an installed font. Fira Code is bundled, with support for programming ligatures.',
  },
  {
    id: 'markdown-font', eyebrow: 'WRITE AND REVIEW CLEARLY', title: 'Set your Markdown fonts',
    description: 'Personalize the editor, rendered text, and code blocks independently.',
    caption: 'All set. Open or clone a repository to start; change any of these choices later in Preferences.',
  },
] as const;
