export interface CliHarnessReadiness {
  cliType: string;
  executablePath: string | null;
  executableFound: boolean;
  attachedToHarness: false;
  requiredProtocol: string;
  message: string;
}
