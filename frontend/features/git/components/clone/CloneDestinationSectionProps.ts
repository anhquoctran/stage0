export interface CloneDestinationSectionProps {
  isCloning: boolean;
  destinationPath: string;
  parentDir: string;
  handleBrowseFolder: () => Promise<void>;
}
