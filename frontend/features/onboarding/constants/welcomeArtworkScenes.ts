export const WELCOME_ARTWORK_SCENES = {
  welcome: {
    title: 'Two branches. One clear picture.',
    description: 'Follow a change from its first commit to a thoughtful review.',
    metrics: [{ value: '02', label: 'Branches' }, { value: '03', label: 'Changed files' }, { value: '01', label: 'Review workspace' }],
    steps: ['Choose branches', 'Explore changes', 'Collect notes'],
  },
  compare: {
    title: 'The details make the difference.',
    description: 'A file overview, a focused diff, and the context to connect them.',
    metrics: [{ value: '+13', label: 'Added lines' }, { value: '−03', label: 'Removed lines' }, { value: '02', label: 'Possible conflicts' }],
    steps: ['Compare', 'Inspect', 'Understand'],
  },
  review: {
    title: 'Turn changes into a conversation.',
    description: 'Keep the why, the feedback, and the follow-up together.',
    metrics: [{ value: '01', label: 'Local draft' }, { value: '02', label: 'Labels' }, { value: '03', label: 'Review notes' }],
    steps: ['Describe', 'Discuss', 'Revisit'],
  },
} as const;
