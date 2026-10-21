export const getProviderDisplayName = (id: string, customName?: string) => {
  switch (id) {
    case 'openai':
      return 'OpenAI / ChatGPT';
    case 'anthropic':
      return 'Anthropic Claude';
    case 'gemini':
      return 'Google Gemini';
    case 'xai_grok':
      return 'SuperGrok';
    case 'ollama':
      return 'Ollama (Local)';
    case 'custom':
      return customName?.trim() || 'Custom Endpoint';
    default:
      return id;
  }
};

