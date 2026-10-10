export interface GitBinaryTabProps {
  draftBinaryId: string;
  draftBinaryPath: string;
  onSelectBinary: (id: string, path: string) => void;
  committedBinaryId: string;
  committedBinaryPath: string;
}
