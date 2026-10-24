export const WELCOME_SLIDES = [
  {
    id: 'welcome', eyebrow: 'A FRIENDLIER WAY TO REVIEW', title: 'Welcome to Stage0',
    description: 'Understand what a branch will bring into your project before you merge it. Stage0 gives you a clear place to compare, inspect, and review.',
    caption: 'Start with two branches. Keep your working copy right where it is.',
    highlights: [
      { title: 'Start with your repository', description: 'Open a project on disk or clone a remote repository. There is no need to move your existing work.' },
      { title: 'Build a clear picture', description: 'Explore the changes, understand the context, and collect review notes before deciding what comes next.' },
    ],
  },
  {
    id: 'compare', eyebrow: 'COMPARE WITH CONFIDENCE', title: 'Know what will change',
    description: 'Choose a base branch and a branch to compare. Review changed files and likely merge conflicts before deciding what to do next.',
    caption: 'Reviewing does not check out or merge branches into your working tree or Git index.',
    highlights: [
      { title: 'Read the change, not just the file', description: 'Follow additions and deletions in a focused diff, then inspect the surrounding code when you need more context.' },
      { title: 'Spot friction before merging', description: 'See likely conflicts early. Inspect the affected files and plan your next step without changing branches.' },
    ],
  },
  {
    id: 'review', eyebrow: 'YOUR REVIEW, READY WHEN YOU ARE', title: 'Keep the conversation together',
    description: 'Save a local Virtual MR with its description, labels, comments, and review notes. Come back to the same review whenever you need it.',
    caption: 'Next, make Stage0 feel familiar with your own theme, shortcuts, and fonts.',
    highlights: [
      { title: 'Keep context close to the code', description: 'Add a description, organize the review with labels, and discuss individual changes in one place.' },
      { title: 'Pick up where you left off', description: 'Reopen your local merge request to revisit notes. Configure optional reviewer bots in Preferences when you are ready.' },
    ],
  },
  {
    id: 'theme', eyebrow: 'YOUR WORKSPACE, YOUR STYLE', title: 'Choose your theme',
    description: 'Follow your system appearance or choose a light or dark workspace.',
    caption: 'System is the default. Preview your choice now and change it later in Preferences.',
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
    caption: 'Next, connect an LLM provider or ACP agent to enable AI reviews.',
  },
  {
    id: 'ai-setup', eyebrow: 'THE CORE OF YOUR WORKFLOW', title: 'Set up your AI connection',
    description: 'Connect an LLM provider or add an ACP agent to power the AI review workflow.',
    caption: 'Save at least one AI connection, then continue to open or clone your repository.',
  },
  {
    id: 'repository', eyebrow: 'YOUR WORKSPACE IS READY', title: 'Start with a repository',
    description: 'Open a local Git project or clone a remote repository to begin your first review.',
    caption: 'Your theme, shortcuts, and fonts are saved when you continue.',
    highlights: [
      { title: 'Open an existing project', description: 'Choose a Git repository on your computer and start comparing branches.' },
      { title: 'Bring a remote project into your workspace', description: 'Clone a repository from its Git URL into a folder you choose.' },
    ],
  },
] as const;
