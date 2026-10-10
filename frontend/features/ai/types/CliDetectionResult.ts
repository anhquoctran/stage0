export interface CliDetectionResult {
  cli_type: string;
  available: boolean;
  version?: string;
  logged_in: boolean;
  auth_info?: string;
  executable_path?: string;
  error?: string;
}
