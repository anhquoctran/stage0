import React from 'react';

export interface RepositoryCustomRulesSectionProps {
  RULE_SNIPPETS: { label: string; text: string }[];
  handleAppendSnippet: (text: string) => void;
  customRules: string;
  setCustomRules: React.Dispatch<React.SetStateAction<string>>;
}
