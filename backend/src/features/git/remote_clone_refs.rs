use serde::Serialize;
use std::collections::BTreeSet;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteCloneRefs {
    pub branches: Vec<String>,
    pub tags: Vec<String>,
    pub default_branch: Option<String>,
}

impl RemoteCloneRefs {
    pub fn read(command: &mut std::process::Command, url: &str) -> Result<Self, String> {
        // Patterns include HEAD so the default branch can be identified. Do not
        // use --exit-code: an empty repository is still a valid remote.
        command.args([
            "ls-remote",
            "--symref",
            "--",
            url,
            "HEAD",
            "refs/heads/*",
            "refs/tags/*",
        ]);
        let output = crate::common::process::run_bounded_command(
            command,
            8 * 1024 * 1024,
            1024 * 1024,
            std::time::Duration::from_secs(120),
        )
        .map_err(|error| {
            super::runner::redact_sensitive_text(&format!(
                "Could not load remote branches and tags: {error}"
            ))
        })?;
        if output.output_truncated {
            return Err("Remote branch and tag listing exceeded the safety limit. Please narrow the repository's advertised refs.".into());
        }
        if !output.status.success() {
            let stderr =
                super::runner::redact_sensitive_text(&String::from_utf8_lossy(&output.stderr));
            return Err(if stderr.trim().is_empty() {
                "Could not access the repository. Check the URL, network connection and authentication.".into()
            } else {
                stderr.trim().to_string()
            });
        }
        Ok(Self::parse(&String::from_utf8_lossy(&output.stdout)))
    }

    pub fn parse(output: &str) -> Self {
        let mut branches = BTreeSet::new();
        let mut tags = BTreeSet::new();
        let mut default_branch = None;
        for line in output.lines() {
            let Some((object, reference)) = line.split_once('\t') else {
                continue;
            };
            if reference == "HEAD" {
                if let Some(branch) = object.strip_prefix("ref: refs/heads/") {
                    default_branch = Some(branch.to_string());
                }
                continue;
            }
            if !matches!(object.len(), 40 | 64)
                || !object.bytes().all(|byte| byte.is_ascii_hexdigit())
            {
                continue;
            }
            if let Some(branch) = reference.strip_prefix("refs/heads/") {
                if !branch.is_empty() {
                    branches.insert(branch.to_string());
                }
            } else if let Some(tag) = reference.strip_prefix("refs/tags/") {
                if !tag.is_empty() && !tag.ends_with("^{}") {
                    tags.insert(tag.to_string());
                }
            }
        }
        Self {
            branches: branches.into_iter().collect(),
            tags: tags.into_iter().collect(),
            default_branch,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::RemoteCloneRefs;

    #[test]
    fn parses_symbolic_head_branches_and_tags_without_duplicate_peeled_tags() {
        let hash = "a".repeat(40);
        let output = format!("ref: refs/heads/main\tHEAD\n{hash}\tHEAD\n{hash}\trefs/heads/main\n{hash}\trefs/heads/feature/a\n{hash}\trefs/tags/v1\n{hash}\trefs/tags/v1^{{}}\n{hash}\trefs/tags/v1\n{hash}\trefs/pull/1/head\ninvalid\trefs/heads/bogus\n");
        let refs = RemoteCloneRefs::parse(&output);
        assert_eq!(refs.default_branch.as_deref(), Some("main"));
        assert_eq!(refs.branches, ["feature/a", "main"]);
        assert_eq!(refs.tags, ["v1"]);
    }

    #[test]
    fn accepts_empty_repositories_and_sha256_refs() {
        let refs = RemoteCloneRefs::parse("");
        assert!(refs.branches.is_empty() && refs.tags.is_empty() && refs.default_branch.is_none());
        assert_eq!(
            RemoteCloneRefs::parse(&format!("{}\trefs/heads/main", "b".repeat(64))).branches,
            ["main"]
        );
    }

    #[test]
    fn lists_real_git_refs_read_only_including_empty_repositories() {
        let directory =
            std::env::temp_dir().join(format!("clone_refs_test_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&directory).unwrap();
        let outcome = std::panic::catch_unwind(|| {
            let git = |args: &[&str]| {
                let output = std::process::Command::new("git")
                    .current_dir(&directory)
                    .args([
                        "-c",
                        "commit.gpgsign=false",
                        "-c",
                        "tag.gpgsign=false",
                        "-c",
                        "user.name=Fixture",
                        "-c",
                        "user.email=fixture@example.test",
                    ])
                    .args(args)
                    .output()
                    .unwrap();
                assert!(
                    output.status.success(),
                    "{}",
                    String::from_utf8_lossy(&output.stderr)
                );
                String::from_utf8_lossy(&output.stdout).to_string()
            };
            git(&["init", "--template=", "-b", "main"]);
            let read = || {
                RemoteCloneRefs::read(
                    &mut std::process::Command::new("git"),
                    directory.to_str().unwrap(),
                )
                .unwrap()
            };
            assert!(read().branches.is_empty());
            git(&["commit", "--allow-empty", "-m", "Fixture"]);
            git(&["branch", "feature/test"]);
            git(&["tag", "v1"]);
            git(&["tag", "-a", "v2", "-m", "Annotated"]);
            let before = git(&["show-ref"]);
            let refs = read();
            assert_eq!(refs.default_branch.as_deref(), Some("main"));
            assert_eq!(refs.branches, ["feature/test", "main"]);
            assert_eq!(refs.tags, ["v1", "v2"]);
            assert_eq!(git(&["show-ref"]), before);
        });
        std::fs::remove_dir_all(&directory).unwrap();
        if let Err(error) = outcome {
            std::panic::resume_unwind(error);
        }
    }
}
