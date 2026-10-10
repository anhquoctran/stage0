use super::GitCredentialMeta;

pub struct SystemGitCredentialDiscovery {
    pub credentials: Vec<GitCredentialMeta>,
    pub complete: bool,
}
