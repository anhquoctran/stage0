export interface RepoValidation {
  is_valid: boolean;
  exists: boolean;
  has_git: boolean;
  has_permission: boolean;
  error_message?: string | null;
}
