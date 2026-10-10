// Zed-inspired sleek toggle switch
export interface ZedSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
}
