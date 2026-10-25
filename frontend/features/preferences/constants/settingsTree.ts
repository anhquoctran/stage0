import type { TreeCategory } from '../types/TreeCategory';

// Tree view hierarchy matching Zed's structure
export const SETTINGS_TREE: TreeCategory[] = [
  {
    id: 'general',
    label: 'General',
    children: [
      {
        id: 'general-keymaps', label: 'Keymap', title: 'Keymap & Keyboard Shortcuts',
        description: 'Choose a familiar preset or customize Stage0 commands and navigation.',
        keywords: ['keymap', 'keyboard', 'shortcuts', 'bindings', 'vscode', 'jetbrains', 'github desktop', 'fork', 'sourcetree', 'source tree', 'gitkraken', 'git kraken'],
      },
      {
        id: 'general-settings',
        label: 'General Settings',
        title: 'General Settings',
        description: 'Configure inline annotations, startup behavior, Explorer integration, and the terminal command.',
        keywords: ['blame', 'stream', 'accessible', 'general', 'notifications', 'startup', 'windows', 'background', 'explorer', 'boot', 'terminal', 'path', 'stage0'],
      },
    ],
  },
  {
    id: 'appearance',
    label: 'Appearance',
    children: [
      {
        id: 'appearance-theme',
        label: 'Theme',
        title: 'Theme & Interface Mode',
        description: 'Choose whether to use the selected light or dark theme or follow your OS appearance.',
        keywords: ['theme', 'dark', 'light', 'mocha', 'latte', 'color', 'mode', 'appearance', 'palette'],
      },
      {
        id: 'appearance-fonts',
        label: 'Buffer Font',
        title: 'Buffer Font & Typography',
        description: 'Font family, font size, weight, line height, and ligature rendering for editor panes.',
        keywords: ['font', 'family', 'size', 'ligatures', 'bold', 'italic', 'underline', 'spacing', 'typography'],
      },
      {
        id: 'appearance-ui-font', label: 'UI Font', title: 'UI Font',
        description: 'Choose the font used for menus, navigation, labels, and buttons.',
        keywords: ['ui', 'interface', 'font', 'family', 'typography', 'menus'],
      },
      {
        id: 'appearance-markdown-font',
        label: 'Markdown Font',
        title: 'Markdown Font & Typography',
        description: 'Configure fonts for the Markdown editor, rendered preview, and code blocks, plus preview size and heading weight.',
        keywords: ['markdown', 'preview', 'editor', 'font', 'heading', 'weight', 'code', 'typography'],
      },
    ],
  },
  {
    id: 'editor',
    label: 'Editor & Diff',
    children: [
      {
        id: 'editor-diff',
        label: 'Diff Viewer',
        title: 'Diff Viewer & Code Navigation',
        description: 'Configure split/unified diff visualization, whitespace sensitivity, and inline blame.',
        keywords: ['diff', 'split', 'unified', 'whitespace', 'viewer', 'blame'],
      },
    ],
  },
  {
    id: 'ai',
    label: 'AI',
    children: [
      {
        id: 'ai-overview',
        label: 'General',
        title: 'AI',
        description: 'Whether opening a virtual MR or repository automatically enables AI assistant context.',
        keywords: ['ai', 'overview', 'llm', 'providers', 'mcp', 'agents', 'reviewers', 'skills', 'sandbox'],
      },
      {
        id: 'ai-providers',
        label: 'LLM Providers',
        title: 'LLM Providers',
        description: 'Configure natively-included model providers (OpenAI, Anthropic, DeepSeek, Ollama, etc.).',
        keywords: ['openai', 'anthropic', 'deepseek', 'ollama', 'model', 'api key', 'provider', 'groq'],
      },
      {
        id: 'ai-mcp',
        label: 'MCP Servers',
        title: 'MCP Servers',
        description: 'View, add, configure, and remove Model Context Protocol servers.',
        keywords: ['mcp', 'protocol', 'servers', 'stdio', 'sse', 'tools'],
      },
      {
        id: 'ai-external-agents',
        label: 'External Agents',
        title: 'External Agents',
        description: 'Find, add, sign in to, and remove agents through the Agent Client Protocol.',
        keywords: ['agents', 'acp', 'registry', 'subscription', 'cloud'],
      },
      {
        id: 'ai-reviewers',
        label: 'Reviewer Bots',
        title: 'Reviewer Bots',
        description: 'Configure reviewer roles and supplemental instructions for code reviews.',
        keywords: ['reviewers', 'bots', 'code review', 'persona'],
      },
      {
        id: 'ai-sandbox',
        label: 'Sandbox',
        title: 'Sandbox & Tool Permissions',
        description: 'Review and change the elevated virtual sandbox permissions (In-Memory, Docker, Host).',
        keywords: ['sandbox', 'docker', 'container', 'in_memory', 'isolation', 'terminal', 'permissions'],
      },
      {
        id: 'ai-guardrails',
        label: 'Security & Guardrails',
        title: 'Security & Guardrails',
        description: 'Path restrictions, destructive command blocking, and approval thresholds.',
        keywords: ['guardrails', 'security', 'sandbox', 'policy', 'safety', 'destructive', 'permission', 'tokens'],
      },
    ],
  },
  {
    id: 'git',
    label: 'Version Control',
    children: [
      {
        id: 'git-binary',
        label: 'Git Executable',
        title: 'Git Executable',
        description: 'Select the Git executable used for repository operations. Saved Git credentials are not currently injected into Git commands.',
        keywords: ['git', 'binary', 'executable', 'path', 'runner'],
      },
      {
        id: 'git-credentials',
        label: 'Git Credentials',
        title: 'Git Credentials & Remotes',
        description: 'Manage Stage0 credentials and mappings discovered from system/global Git helpers.',
        keywords: ['credentials', 'token', 'pat', 'github', 'gitlab', 'auth'],
      },
    ],
  },
  {
    id: 'notifications',
    label: 'Notifications',
    children: [
      {
        id: 'notifications-settings',
        label: 'Push & Alerts',
        title: 'Notifications & Push Alerts',
        description: 'Configure native operating system notifications and event channels.',
        keywords: ['notifications', 'push', 'alerts', 'sound', 'desktop', 'native', 'winrt', 'system', 'events'],
      },
    ],
  },
];
