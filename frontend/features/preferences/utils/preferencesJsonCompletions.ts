import { KEYMAP_PRESETS, keymapCatalog } from '../../../core/services/keymaps/catalog';
import { MARKDOWN_CODE_FONTS, MARKDOWN_EDITOR_FONTS, MARKDOWN_PROSE_FONTS } from '../constants/markdownFonts';
import { availableUiFontFamilies } from '../services/systemFontCatalog';

const PROPERTY_NAMES: Record<string, string[]> = {
  '': ['schemaVersion', 'keymap', 'general', 'appearance', 'ai', 'reviewers', 'sandbox', 'git', 'notifications'],
  keymap: ['preset', 'overrides'],
  'keymap.overrides.[]': ['command', 'keys'],
  general: ['showInlineBlame', 'streamResponse', 'enableCodeReviewAssist'],
  appearance: ['themeMode', 'uiFont', 'viewerFont', 'markdownFont'],
  'appearance.uiFont': ['fontFamily'],
  'appearance.markdownFont': ['fontFamily', 'codeFontFamily', 'editorFontFamily', 'fontSize', 'headingFontWeight'],
  'appearance.viewerFont': ['fontFamily', 'fontSize', 'isBold', 'isItalic', 'isUnderline', 'lineSpacing', 'enableLigatures'],
  ai: ['aiConfig', 'mcpServers', 'guardrailPolicy', 'externalAgents'],
  'ai.aiConfig': ['provider', 'model', 'baseUrl', 'temperature', 'reasoningEffort', 'fastMode', 'maxTokens', 'reviewerInstructions', 'streamResponse', 'enableCodeReviewAssist', 'providerSettings', 'customProviderName'],
  'ai.aiConfig.providerSettings': ['openai', 'anthropic', 'gemini', 'xai_grok', 'ollama', 'custom'],
  'ai.aiConfig.providerSettings.openai': ['model', 'baseUrl', 'reasoningEffort', 'fastMode'],
  'ai.aiConfig.providerSettings.anthropic': ['model', 'baseUrl', 'reasoningEffort', 'fastMode'],
  'ai.aiConfig.providerSettings.gemini': ['model', 'baseUrl', 'reasoningEffort', 'fastMode'],
  'ai.aiConfig.providerSettings.xai_grok': ['model', 'baseUrl', 'reasoningEffort', 'fastMode'],
  'ai.aiConfig.providerSettings.ollama': ['model', 'baseUrl', 'reasoningEffort', 'fastMode'],
  'ai.aiConfig.providerSettings.custom': ['model', 'baseUrl', 'reasoningEffort', 'fastMode'],
  'ai.mcpServers.[]': ['id', 'name', 'description', 'type', 'command', 'args', 'env', 'secretEnvKeys', 'url', 'cwd', 'enabled'],
  'ai.externalAgents.[]': ['id', 'name', 'version', 'description', 'source', 'command', 'args'],
  'ai.guardrailPolicy': ['mode', 'allowed_commands', 'blocked_commands', 'blocked_patterns', 'sensitive_path_patterns', 'max_execution_timeout_secs', 'max_file_read_lines', 'max_output_bytes', 'rate_limit_per_minute', 'require_human_confirmation_for_commands', 'require_human_confirmation_for_writes'],
  'reviewers.[]': ['id', 'name', 'tagline', 'description', 'category', 'avatarEmoji', 'customInstructions', 'enabled', 'provider', 'model', 'temperature', 'reasoningEffort', 'fastMode', 'isBuiltin'],
  sandbox: ['type'],
  git: ['binaryId', 'binaryPath'],
  notifications: ['channels'],
  'notifications.channels': ['aiReview', 'gitSync', 'guardrails'],
};

const VALUE_OPTIONS: Record<string, string[]> = {
  'keymap.preset': KEYMAP_PRESETS.map((preset) => preset.id),
  'keymap.overrides.[].command': keymapCatalog().filter((command) => command.editable).map((command) => command.id),
  'appearance.themeMode': ['system', 'dark', 'light'],
  'appearance.markdownFont.fontFamily': MARKDOWN_PROSE_FONTS,
  'appearance.markdownFont.codeFontFamily': MARKDOWN_CODE_FONTS,
  'appearance.markdownFont.editorFontFamily': MARKDOWN_EDITOR_FONTS,
  'appearance.viewerFont.fontFamily': ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Source Code Pro', 'Hack', 'Iosevka', 'IBM Plex Mono', 'Monaspace', 'Victor Mono', 'Geist Mono'],
  'ai.aiConfig.provider': ['openai', 'anthropic', 'gemini', 'xai_grok', 'ollama', 'custom'],
  'ai.aiConfig.reasoningEffort': ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'],
  'ai.mcpServers.[].type': ['stdio', 'http', 'sse'],
  'ai.guardrailPolicy.mode': ['strict', 'balanced', 'permissive'],
  'reviewers.[].category': ['security', 'performance', 'architecture', 'style', 'test', 'documentation', 'custom'],
  'reviewers.[].reasoningEffort': ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'],
  'sandbox.type': ['in_memory', 'local_worktree', 'docker'],
};

const BOOLEAN_PROPERTIES = new Set([
  'general.showInlineBlame', 'general.streamResponse', 'general.enableCodeReviewAssist',
  'appearance.viewerFont.isBold', 'appearance.viewerFont.isItalic', 'appearance.viewerFont.isUnderline',
  'appearance.viewerFont.enableLigatures', 'ai.aiConfig.fastMode', 'ai.aiConfig.streamResponse',
  'ai.aiConfig.enableCodeReviewAssist', 'ai.mcpServers.[].enabled', 'reviewers.[].enabled',
  'reviewers.[].fastMode', 'reviewers.[].isBuiltin', 'notifications.channels.aiReview',
  'notifications.channels.gitSync', 'notifications.channels.guardrails',
  'ai.guardrailPolicy.require_human_confirmation_for_commands',
  'ai.guardrailPolicy.require_human_confirmation_for_writes',
]);

const NUMBER_OPTIONS: Record<string, string[]> = {
  schemaVersion: ['1'],
  'appearance.viewerFont.fontSize': ['12', '13', '14', '16'],
  'appearance.markdownFont.fontSize': ['12', '14', '16'],
  'appearance.markdownFont.headingFontWeight': ['400', '500', '600', '700'],
  'appearance.viewerFont.lineSpacing': ['1', '1.25', '1.5', '1.75', '2'],
  'ai.aiConfig.temperature': ['0', '0.2', '0.7', '1'],
  'ai.aiConfig.maxTokens': ['2048', '4096', '8192'],
  'reviewers.[].temperature': ['0', '0.2', '0.7', '1'],
  'reviewers.[].maxTokens': ['2048', '4096', '8192'],
};

export function hidePreferencesSchemaProperty(source: string): string {
  let braces = 0;
  let brackets = 0;
  for (let index = 0; index < source.length;) {
    if (source.startsWith('//', index)) {
      const newline = source.indexOf('\n', index + 2);
      index = newline < 0 ? source.length : newline + 1;
      continue;
    }
    if (source.startsWith('/*', index)) {
      const end = source.indexOf('*/', index + 2);
      index = end < 0 ? source.length : end + 2;
      continue;
    }
    if (source[index] === '"') {
      let end = index + 1;
      let escaped = false;
      while (end < source.length) {
        const character = source[end];
        end++;
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') break;
      }
      if (braces === 1 && brackets === 0 && source[end - 1] === '"') {
        let key: string | undefined;
        try { key = JSON.parse(source.slice(index, end)) as string; } catch { /* Ignore malformed strings in an editable draft. */ }
        let delimiter = end;
        while (/\s/.test(source[delimiter] ?? '')) delimiter++;
        if (key === '$schema' && source[delimiter] === ':') {
          const lineStart = source.lastIndexOf('\n', index - 1) + 1;
          const linePrefix = source.slice(lineStart, index);
          if (/^[ \t]*$/.test(linePrefix)) {
            const lineEnd = source.indexOf('\n', end);
            return source.slice(0, lineStart) + source.slice(lineEnd < 0 ? source.length : lineEnd + 1);
          }
        }
      }
      index = end;
      continue;
    }
    if (source[index] === '{') braces++;
    else if (source[index] === '}') braces--;
    else if (source[index] === '[') brackets++;
    else if (source[index] === ']') brackets--;
    index++;
  }
  return source;
}

export function getPreferencesJsonCompletions(source: string, cursor: number, explicit = false) {
  const context = findContext(source, Math.max(0, Math.min(cursor, source.length)));
  if (!context) return null;

  const path = context.path.join('.');
  const propertyPath = context.kind === 'value' ? [...context.path, context.property ?? ''].filter(Boolean).join('.') : path;
  let labels: string[];
  if (context.kind === 'key') {
    labels = (PROPERTY_NAMES[path] ?? []).filter((name) => !context.seenKeys.has(name));
  } else if (propertyPath === 'appearance.uiFont.fontFamily') {
    labels = availableUiFontFamilies();
  } else if (VALUE_OPTIONS[propertyPath]) {
    labels = VALUE_OPTIONS[propertyPath];
  } else if (BOOLEAN_PROPERTIES.has(propertyPath)) {
    labels = ['true', 'false'];
  } else {
    labels = NUMBER_OPTIONS[propertyPath] ?? [];
  }

  const triggerCharacter = source[cursor - 1] ?? '';
  if (!explicit && !context.prefix && triggerCharacter !== '"' && triggerCharacter !== ':') return null;
  const matches = labels.filter((label) => label.toLowerCase().startsWith(context.prefix.toLowerCase()));
  if (!matches.length) return null;

  const items = matches.map((label) => ({
    label,
    detail: context.kind === 'key' ? 'Preference property' : 'Suggested value',
    insertText: context.kind === 'key'
      ? `${JSON.stringify(label)}: `
      : VALUE_OPTIONS[propertyPath] || propertyPath === 'appearance.uiFont.fontFamily' ? JSON.stringify(label) : label,
  }));
  return { ...context, items };
}

function findContext(source: string, cursor: number) {
  const frames: { type: 'object' | 'array'; path: string[]; state: 'key' | 'colon' | 'value' | 'comma'; property?: string; seenKeys: Set<string> }[] = [];
  let index = 0;
  const readStringEnd = (start: number) => {
    let escaped = false;
    for (let end = start + 1; end < source.length; end++) {
      const character = source[end];
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') return end;
    }
    return -1;
  };
  const contextFor = (frame: typeof frames[number], kind: 'key' | 'value', prefix: string, start: number, end: number, quoted: boolean) => ({
    kind,
    path: [...frame.path],
    property: kind === 'value' ? frame.property : undefined,
    prefix,
    replaceStart: start,
    replaceEnd: end,
    quoted,
    seenKeys: new Set(frame.seenKeys),
  });

  while (index < cursor) {
    const character = source[index];
    if (/\s/.test(character)) { index++; continue; }
    if (source.startsWith('//', index)) {
      const newline = source.indexOf('\n', index + 2);
      index = newline < 0 || newline >= cursor ? cursor : newline + 1;
      continue;
    }
    if (source.startsWith('/*', index)) {
      const end = source.indexOf('*/', index + 2);
      index = end < 0 || end + 2 >= cursor ? cursor : end + 2;
      continue;
    }

    const frame = frames.at(-1);
    if (character === '"') {
      const end = readStringEnd(index);
      const tokenEnd = end < 0 ? source.length : end + 1;
      if (frame && cursor >= index + 1 && cursor <= tokenEnd) {
        const kind = frame.type === 'object' && frame.state === 'key' ? 'key'
          : frame.type === 'object' && frame.state === 'value' ? 'value'
            : frame.type === 'array' && frame.state === 'value' ? 'value' : null;
        if (kind) {
          const prefixEnd = Math.min(cursor, end < 0 ? cursor : end);
          const prefix = source.slice(index + 1, prefixEnd);
          let replaceEnd = end < 0 ? cursor : end + 1;
          if (kind === 'key' && end >= 0) {
            let afterKey = end + 1;
            while (/\s/.test(source[afterKey] ?? '')) afterKey++;
            if (source[afterKey] === ':') {
              afterKey++;
              while (/\s/.test(source[afterKey] ?? '')) afterKey++;
              replaceEnd = afterKey;
            }
          }
          return contextFor(
            frame,
            kind,
            prefix,
            index,
            replaceEnd,
            true,
          );
        }
      }
      if (end < 0 || tokenEnd > cursor) return null;
      let value = source.slice(index + 1, end);
      try { value = JSON.parse(source.slice(index, tokenEnd)) as string; } catch { /* Keep malformed draft text as the key prefix. */ }
      if (frame?.type === 'object') {
        if (frame.state === 'key') {
          frame.property = value;
          frame.seenKeys.add(value);
          frame.state = 'colon';
        } else if (frame.state === 'value') {
          frame.state = 'comma';
          frame.property = undefined;
        }
      } else if (frame?.type === 'array' && frame.state === 'value') frame.state = 'comma';
      index = tokenEnd;
      continue;
    }

    if (character === '{' || character === '[') {
      let path: string[] = [];
      if (frame?.type === 'object' && frame.state === 'value') {
        path = [...frame.path, frame.property ?? ''].filter(Boolean);
        frame.property = undefined;
        frame.state = 'comma';
      } else if (frame?.type === 'array' && frame.state === 'value') {
        path = [...frame.path, '[]'];
        frame.state = 'comma';
      }
      frames.push({ type: character === '{' ? 'object' : 'array', path, state: character === '{' ? 'key' : 'value', seenKeys: new Set() });
      index++;
      continue;
    }
    if (character === '}' || character === ']') { frames.pop(); index++; continue; }
    if (character === ':') {
      if (frame?.type === 'object' && frame.state === 'colon') frame.state = 'value';
      index++;
      continue;
    }
    if (character === ',') {
      if (frame?.type === 'object') { frame.state = 'key'; frame.property = undefined; }
      else if (frame?.type === 'array') frame.state = 'value';
      index++;
      continue;
    }

    const end = source.slice(index).search(/[\s,}\]]/);
    const tokenEnd = end < 0 ? source.length : index + end;
    if (frame && cursor >= index && cursor <= tokenEnd) {
      const kind = frame.state === 'value' ? 'value' : null;
      if (kind) return contextFor(frame, kind, source.slice(index, cursor), index, tokenEnd, false);
    }
    if (frame?.state === 'value') {
      frame.state = 'comma';
      frame.property = undefined;
    }
    index = Math.max(index + 1, tokenEnd);
  }

  const frame = frames.at(-1);
  if (!frame) return null;
  if (frame.type === 'object' && frame.state === 'key') return contextFor(frame, 'key', '', cursor, cursor, false);
  if (frame.type === 'object' && frame.state === 'value') return contextFor(frame, 'value', '', cursor, cursor, false);
  if (frame.type === 'array' && frame.state === 'value') return contextFor(frame, 'value', '', cursor, cursor, false);
  return null;
}
