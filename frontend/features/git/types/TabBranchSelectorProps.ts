export interface TabBranchSelectorProps {
  value: string;
  roleType: 'source' | 'target'; // 'source' = Compare, 'target' = Base
  branches: {
    current: string;
    local: string[];
    remote: string[];
  } | null;
  onChange: (branch: string) => void;
  disabled?: boolean;
  className?: string;
  maxWidthClass?: string;
  buttonClassName?: string;
}
