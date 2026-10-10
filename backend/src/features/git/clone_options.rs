use serde::Deserialize;
use std::process::Command;
use std::time::Duration;

#[derive(Debug, Default, Deserialize)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
pub struct CloneOptions {
    pub branch: String,
    pub depth: Option<u32>,
    pub single_branch: bool,
    pub no_tags: bool,
    pub blobless: bool,
    pub sparse: bool,
    pub recurse_submodules: bool,
    pub shallow_submodules: bool,
    pub filter_submodules: bool,
    pub submodule_jobs: Option<u16>,
    pub skip_lfs: bool,
    pub timeout_minutes: Option<u16>,
}

impl CloneOptions {
    pub fn git_arguments(&self) -> Result<Vec<String>, String> {
        if self
            .depth
            .is_some_and(|depth| depth == 0 || depth > 1_000_000)
        {
            return Err("Clone depth must be between 1 and 1,000,000 commits.".into());
        }
        if self
            .submodule_jobs
            .is_some_and(|jobs| !(1..=32).contains(&jobs))
        {
            return Err("Submodule parallel jobs must be between 1 and 32.".into());
        }
        if self
            .timeout_minutes
            .is_some_and(|minutes| !(1..=1440).contains(&minutes))
        {
            return Err("Clone timeout must be between 1 and 1,440 minutes.".into());
        }
        if self.shallow_submodules && !self.recurse_submodules {
            return Err("Shallow submodules requires recursive submodule cloning.".into());
        }
        if self.filter_submodules && !(self.recurse_submodules && self.blobless) {
            return Err(
                "Filtering submodules requires recursive submodules and partial clone.".into(),
            );
        }
        let branch = self.branch.trim();
        if !branch.is_empty() {
            if branch.len() > 1024
                || branch.starts_with('-')
                || branch.contains('@')
                || branch.chars().any(char::is_control)
            {
                return Err("Invalid clone branch or tag name.".into());
            }
            let mut command = Command::new(super::runner::get_active_git_path());
            command.args(["check-ref-format", &format!("refs/heads/{branch}")]);
            let output = crate::common::process::run_bounded_command(
                &mut command,
                4096,
                4096,
                Duration::from_secs(5),
            )?;
            if !output.status.success() || output.output_truncated {
                return Err("Invalid clone branch or tag name.".into());
            }
        }
        let mut args = vec!["clone".into(), "--progress".into()];
        if !branch.is_empty() {
            args.push(format!("--branch={branch}"));
        }
        if let Some(depth) = self.depth {
            args.push(format!("--depth={depth}"));
        }
        // Depth implies single-branch in Git; explicitly honor the user's choice.
        args.push(
            if self.single_branch {
                "--single-branch"
            } else {
                "--no-single-branch"
            }
            .into(),
        );
        if self.no_tags {
            args.push("--no-tags".into());
        }
        if self.blobless {
            args.push("--filter=blob:none".into());
        }
        if self.sparse {
            args.push("--sparse".into());
        }
        if self.recurse_submodules {
            args.push("--recurse-submodules".into());
            args.push(format!("--jobs={}", self.submodule_jobs.unwrap_or(4)));
            if self.shallow_submodules {
                args.push("--shallow-submodules".into());
            }
            if self.filter_submodules {
                args.push("--also-filter-submodules".into());
            }
        }
        Ok(args)
    }

    pub fn timeout(&self) -> Duration {
        Duration::from_secs(u64::from(self.timeout_minutes.unwrap_or(60)) * 60)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_clone_keeps_all_branches_and_history() {
        let options: CloneOptions = serde_json::from_str("{}").unwrap();
        assert_eq!(
            options.git_arguments().unwrap(),
            ["clone", "--progress", "--no-single-branch"]
        );
        assert_eq!(options.timeout(), Duration::from_secs(3600));
    }

    #[test]
    fn builds_bounded_large_repository_options_without_shell_interpolation() {
        let options: CloneOptions = serde_json::from_str(
            r#"{
            "branch":"feature/large", "depth":50, "singleBranch":true,
            "noTags":true, "blobless":true, "sparse":true,
            "recurseSubmodules":true, "shallowSubmodules":true,
            "filterSubmodules":true, "submoduleJobs":8, "skipLfs":true,
            "timeoutMinutes":120
        }"#,
        )
        .unwrap();
        assert_eq!(
            options.git_arguments().unwrap(),
            [
                "clone",
                "--progress",
                "--branch=feature/large",
                "--depth=50",
                "--single-branch",
                "--no-tags",
                "--filter=blob:none",
                "--sparse",
                "--recurse-submodules",
                "--jobs=8",
                "--shallow-submodules",
                "--also-filter-submodules",
            ]
        );
        assert!(options.skip_lfs);
        assert_eq!(options.timeout(), Duration::from_secs(7200));
    }

    #[test]
    fn rejects_invalid_limits_combinations_and_option_injection() {
        for json in [
            r#"{"depth":0}"#,
            r#"{"depth":1000001}"#,
            r#"{"submoduleJobs":0}"#,
            r#"{"submoduleJobs":33}"#,
            r#"{"timeoutMinutes":0}"#,
            r#"{"timeoutMinutes":1441}"#,
            r#"{"shallowSubmodules":true}"#,
            r#"{"filterSubmodules":true}"#,
            r#"{"branch":"--upload-pack=malicious"}"#,
            r#"{"branch":"bad..name"}"#,
            r#"{"branch":"@{-1}"}"#,
            r#"{"branch":"foo\nbar"}"#,
        ] {
            assert!(
                serde_json::from_str::<CloneOptions>(json)
                    .unwrap()
                    .git_arguments()
                    .is_err(),
                "{json}"
            );
        }
        assert!(serde_json::from_str::<CloneOptions>(r#"{"uploadPack":"malicious"}"#).is_err());
    }

    fn fixture_git(repo: &std::path::Path, args: &[&str]) -> String {
        let output = Command::new("git")
            .current_dir(repo)
            .args([
                "-c",
                "commit.gpgsign=false",
                "-c",
                "tag.gpgsign=false",
                "-c",
                "protocol.file.allow=always",
            ])
            .args(args)
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "Git {args:?}: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        String::from_utf8(output.stdout).unwrap().trim().to_string()
    }

    fn fixture_repo(path: &std::path::Path) {
        std::fs::create_dir_all(path).unwrap();
        fixture_git(path, &["init", "--template=", "-b", "main"]);
        fixture_git(path, &["config", "user.name", "Clone Test"]);
        fixture_git(path, &["config", "user.email", "clone@example.test"]);
        std::fs::write(path.join("README.md"), "Clone fixture\n").unwrap();
        fixture_git(path, &["add", "."]);
        fixture_git(path, &["commit", "-m", "Initial"]);
    }

    fn fixture_clone(source: &std::path::Path, target: &std::path::Path, options: &CloneOptions) {
        let url = reqwest::Url::from_file_path(source).unwrap().to_string();
        let mut command = Command::new("git");
        command
            .args(["-c", "clone.filterSubmodules=false"])
            .args(options.git_arguments().unwrap())
            .arg("--")
            .arg(url)
            .arg(target)
            // Fixture-only transport: production still permits only git/http/https/ssh.
            .env("GIT_ALLOW_PROTOCOL", "file")
            .env("GIT_TERMINAL_PROMPT", "0")
            .env("LC_ALL", "C");
        let output = crate::common::process::run_bounded_command_with_progress(
            &mut command,
            super::super::progress::GitProgressReporter::new(None).observer(),
            1024 * 1024,
            1024 * 1024,
            Duration::from_secs(30),
        )
        .unwrap();
        assert!(
            output.status.success(),
            "Clone: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        assert!(!output.output_truncated);
    }

    #[test]
    fn real_clone_handles_shallow_partial_sparse_and_nested_submodules() {
        let root =
            std::env::temp_dir().join(format!("stage0-advanced-clone-{}", uuid::Uuid::new_v4()));
        let result = std::panic::catch_unwind(|| {
            let leaf = root.join("leaf");
            let dependency = root.join("dependency");
            let source = root.join("source");
            fixture_repo(&leaf);
            fixture_repo(&dependency);
            let leaf_url = reqwest::Url::from_file_path(&leaf).unwrap().to_string();
            fixture_git(&dependency, &["submodule", "add", &leaf_url, "nested"]);
            fixture_git(&dependency, &["commit", "-am", "Add nested dependency"]);
            let dependency_pin = fixture_git(&dependency, &["rev-parse", "HEAD"]);
            fixture_repo(&source);
            let dependency_url = reqwest::Url::from_file_path(&dependency)
                .unwrap()
                .to_string();
            fixture_git(
                &source,
                &["submodule", "add", &dependency_url, "deps/library"],
            );
            fixture_git(&source, &["commit", "-am", "Add dependency"]);
            std::fs::create_dir_all(source.join("src")).unwrap();
            std::fs::write(source.join("src/code.txt"), "first version\n").unwrap();
            fixture_git(&source, &["add", "."]);
            fixture_git(&source, &["commit", "-m", "Code version one"]);
            std::fs::write(source.join("src/code.txt"), "second version\n").unwrap();
            fixture_git(&source, &["commit", "-am", "Code version two"]);
            fixture_git(&source, &["branch", "feature/test"]);
            fixture_git(&source, &["tag", "v1.0"]);
            fixture_git(&source, &["config", "uploadpack.allowFilter", "true"]);

            let shallow = root.join("shallow");
            fixture_clone(
                &source,
                &shallow,
                &CloneOptions {
                    depth: Some(2),
                    single_branch: true,
                    no_tags: true,
                    recurse_submodules: true,
                    shallow_submodules: true,
                    submodule_jobs: Some(2),
                    ..Default::default()
                },
            );
            assert_eq!(fixture_git(&shallow, &["rev-list", "--count", "HEAD"]), "2");
            assert_eq!(fixture_git(&shallow, &["tag", "--list"]), "");
            assert_eq!(
                fixture_git(&shallow, &["config", "--get", "remote.origin.fetch"]),
                "+refs/heads/main:refs/remotes/origin/main"
            );
            let cloned_dependency = shallow.join("deps/library");
            assert_eq!(
                fixture_git(&cloned_dependency, &["rev-parse", "HEAD"]),
                dependency_pin
            );
            assert_eq!(
                fixture_git(
                    &cloned_dependency,
                    &["rev-parse", "--is-shallow-repository"]
                ),
                "true"
            );
            assert!(cloned_dependency.join("nested/README.md").is_file());
            assert_eq!(
                fixture_git(&shallow, &["submodule", "status", "--recursive"])
                    .lines()
                    .count(),
                2
            );

            let partial = root.join("partial");
            fixture_clone(
                &source,
                &partial,
                &CloneOptions {
                    blobless: true,
                    sparse: true,
                    ..Default::default()
                },
            );
            assert_eq!(
                fixture_git(
                    &partial,
                    &["config", "--get", "remote.origin.partialclonefilter"]
                ),
                "blob:none"
            );
            assert_eq!(
                fixture_git(&partial, &["config", "--get", "core.sparseCheckout"]),
                "true"
            );
            assert!(partial.join("README.md").is_file());
            assert!(!partial.join("src/code.txt").exists());
            assert!(fixture_git(
                &partial,
                &["rev-list", "--objects", "--all", "--missing=print"]
            )
            .lines()
            .any(|line| line.starts_with('?')));
            assert_eq!(fixture_git(&partial, &["rev-list", "--count", "HEAD"]), "4");
            assert!(fixture_git(&partial, &["branch", "-r"]).contains("origin/feature/test"));
            assert_eq!(
                fixture_git(&partial, &["show", "HEAD:src/code.txt"]),
                "second version"
            );

            let shallow_all = root.join("shallow-all");
            fixture_clone(
                &source,
                &shallow_all,
                &CloneOptions {
                    depth: Some(1),
                    ..Default::default()
                },
            );
            assert!(fixture_git(&shallow_all, &["branch", "-r"]).contains("origin/feature/test"));
        });
        // Only the unique fixture tree is removed, including on test failure.
        let _ = std::fs::remove_dir_all(&root);
        if let Err(panic) = result {
            std::panic::resume_unwind(panic);
        }
    }
}
