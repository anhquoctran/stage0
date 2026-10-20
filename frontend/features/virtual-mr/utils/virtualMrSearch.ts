import type { VirtualMrSession } from '../types/VirtualMrSession';

type SearchField =
  | 'author'
  | 'assignee'
  | 'reviewer'
  | 'approved-by'
  | 'label'
  | 'base'
  | 'head'
  | 'is'
  | 'has'
  | 'no';

interface SearchFieldDefinition {
  key: SearchField;
  label: string;
  description: string;
}

export interface VirtualMrSearchSuggestion {
  kind: 'field' | 'value';
  field: SearchField;
  value: string;
  label: string;
  detail?: string;
}

const SEARCH_FIELDS: SearchFieldDefinition[] = [
  { key: 'author', label: 'Author', description: 'Filter by MR author' },
  { key: 'assignee', label: 'Assignee', description: 'Filter by assignee' },
  { key: 'reviewer', label: 'Reviewer', description: 'Filter by assigned reviewer' },
  { key: 'approved-by', label: 'Approved by', description: 'Filter by reviewer who approved' },
  { key: 'label', label: 'Label', description: 'Filter by repository label' },
  { key: 'base', label: 'Base branch', description: 'Filter by target branch' },
  { key: 'head', label: 'Compare branch', description: 'Filter by source branch' },
  { key: 'is', label: 'Status', description: 'Filter by open, resolved, or approved status' },
  { key: 'has', label: 'Has', description: 'Filter by discussions, reviewers, or labels' },
  { key: 'no', label: 'Without', description: 'Filter by missing assignee, reviewer, or label' },
];

const searchableText = (session: VirtualMrSession): string => [
  session.title,
  session.description,
  session.baseBranch,
  session.compareBranch,
  session.assignee.name,
  session.assignee.email,
  ...session.labels.map((label) => label.name),
  ...session.reviewers.flatMap((reviewer) => [reviewer.agentName, reviewer.agentId]),
].join('\n').toLocaleLowerCase();

const tokenize = (query: string): string[] => {
  const tokens: string[] = [];
  let token = '';
  let insideQuotes = false;
  let escaping = false;

  for (const character of query) {
    if (escaping) {
      token += character;
      escaping = false;
    } else if (character === '\\' && insideQuotes) {
      escaping = true;
    } else if (character === '"') {
      insideQuotes = !insideQuotes;
    } else if (/\s/.test(character) && !insideQuotes) {
      if (token) tokens.push(token);
      token = '';
    } else {
      token += character;
    }
  }

  if (escaping) token += '\\';
  if (token) tokens.push(token);
  return tokens;
};

const matchesField = (session: VirtualMrSession, field: SearchField, value: string): boolean => {
  const query = value.toLocaleLowerCase();
  const matchesAny = (items: string[]) => items.some((item) => item.toLocaleLowerCase().includes(query));

  switch (field) {
    // Virtual MRs currently use the local assignee identity as their author.
    case 'author':
    case 'assignee':
      return matchesAny([session.assignee.name, session.assignee.email]);
    case 'reviewer':
      return matchesAny(session.reviewers.flatMap((reviewer) => [reviewer.agentName, reviewer.agentId]));
    case 'approved-by':
      return matchesAny(session.reviewers
        .filter((reviewer) => reviewer.reviewStatus === 'approved')
        .flatMap((reviewer) => [reviewer.agentName, reviewer.agentId]));
    case 'label':
      return matchesAny(session.labels.map((label) => label.name));
    case 'base':
      return session.baseBranch.toLocaleLowerCase().includes(query);
    case 'head':
      return session.compareBranch.toLocaleLowerCase().includes(query);
    case 'is':
      if (query === 'open') return session.status !== 'closed';
      if (query === 'approved') return session.status === 'approved';
      if (query === 'closed' || query === 'resolved') return session.status === 'closed';
      return false;
    case 'has':
      if (query === 'discussion' || query === 'discussions') return session.discussions.length > 0;
      if (query === 'reviewer' || query === 'reviewers') return session.reviewers.length > 0;
      if (query === 'label' || query === 'labels') return session.labels.length > 0;
      return false;
    case 'no':
      if (query === 'assignee') return !session.assignee.name.trim() && !session.assignee.email.trim();
      if (query === 'reviewer' || query === 'reviewers') return session.reviewers.length === 0;
      if (query === 'label' || query === 'labels') return session.labels.length === 0;
      if (query === 'discussion' || query === 'discussions') return session.discussions.length === 0;
      return false;
  }
};

export const matchesVirtualMrSearch = (session: VirtualMrSession, query: string): boolean => {
  const fields = new Set(SEARCH_FIELDS.map(({ key }) => key));
  return tokenize(query).every((token) => {
    const separator = token.indexOf(':');
    const key = separator > 0 ? token.slice(0, separator).toLocaleLowerCase() : '';
    const value = separator > 0 ? token.slice(separator + 1) : '';

    if (fields.has(key as SearchField)) {
      return value ? matchesField(session, key as SearchField, value) : true;
    }

    // Keep unknown qualifiers searchable as ordinary text instead of silently ignoring them.
    return searchableText(session).includes(token.toLocaleLowerCase());
  });
};

const uniqueValues = (values: string[]): string[] => [...new Set(values.map((value) => value.trim()).filter(Boolean))];

const valuesForField = (field: SearchField, sessions: VirtualMrSession[]) => {
  switch (field) {
    case 'author':
    case 'assignee':
      return uniqueValues(sessions.flatMap((session) => [session.assignee.name, session.assignee.email]))
        .map((value) => ({ value, detail: value.includes('@') ? 'Email' : 'Local user' }));
    case 'reviewer':
      return uniqueValues(sessions.flatMap((session) => session.reviewers.map((reviewer) => reviewer.agentName)))
        .map((value) => ({ value, detail: 'Reviewer' }));
    case 'approved-by':
      return uniqueValues(sessions.flatMap((session) => session.reviewers
        .filter((reviewer) => reviewer.reviewStatus === 'approved')
        .map((reviewer) => reviewer.agentName)))
        .map((value) => ({ value, detail: 'Approved reviewer' }));
    case 'label':
      return uniqueValues(sessions.flatMap((session) => session.labels.map((label) => label.name)))
        .map((value) => ({ value, detail: 'Label' }));
    case 'base':
      return uniqueValues(sessions.map((session) => session.baseBranch)).map((value) => ({ value, detail: 'Target branch' }));
    case 'head':
      return uniqueValues(sessions.map((session) => session.compareBranch)).map((value) => ({ value, detail: 'Source branch' }));
    case 'is':
      return ['open', 'resolved', 'approved'].map((value) => ({ value, detail: 'MR status' }));
    case 'has':
      return [
        { value: 'discussion', detail: 'Has discussions' },
        { value: 'reviewer', detail: 'Has reviewers' },
        { value: 'label', detail: 'Has labels' },
      ];
    case 'no':
      return [
        { value: 'assignee', detail: 'No assignee' },
        { value: 'reviewer', detail: 'No reviewers' },
        { value: 'label', detail: 'No labels' },
        { value: 'discussion', detail: 'No discussions' },
      ];
  }
};

export const getVirtualMrSearchSuggestions = (
  query: string,
  caret: number,
  sessions: VirtualMrSession[],
): VirtualMrSearchSuggestion[] => {
  const beforeCaret = query.slice(0, caret);
  const currentToken = beforeCaret.match(/\S*$/)?.[0] ?? '';
  const separator = currentToken.indexOf(':');
  const lowerToken = currentToken.toLocaleLowerCase();

  if (separator < 0) {
    return SEARCH_FIELDS
      .filter((field) => field.key.startsWith(lowerToken))
      .map((field) => ({
        kind: 'field',
        field: field.key,
        value: field.key,
        label: field.label,
        detail: `${field.key}: · ${field.description}`,
      }));
  }

  const key = lowerToken.slice(0, separator) as SearchField;
  const definition = SEARCH_FIELDS.find((field) => field.key === key);
  if (!definition) return [];

  const valuePrefix = currentToken.slice(separator + 1).toLocaleLowerCase();
  return valuesForField(key, sessions)
    .filter((item) => !valuePrefix || item.value.toLocaleLowerCase().includes(valuePrefix))
    .slice(0, 8)
    .map((item) => ({
      kind: 'value',
      field: key,
      value: item.value,
      label: item.value,
      detail: item.detail,
    }));
};
