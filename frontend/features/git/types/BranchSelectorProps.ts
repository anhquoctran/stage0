export interface BranchSelectorProps {
  label: string;
  value: string;
  branches: {
    current: string;
    local: string[];
    remote: string[];
  } | null;
  onChange: (branch: string) => void;
  disabled?: boolean;
}
