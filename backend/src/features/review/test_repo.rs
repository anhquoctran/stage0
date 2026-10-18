pub struct TestRepo {
    pub path: std::path::PathBuf,
}

impl TestRepo {
    pub fn new() -> Self {
        let repo = Self {
            path: std::env::temp_dir().join(format!("stage0-review-test-{}", uuid::Uuid::new_v4())),
        };
        std::fs::create_dir_all(&repo.path).unwrap();
        repo.git(&["init", "--template=", "-b", "main"]);
        repo.write("source.rs", "fn value() -> u32 { 1 }\n");
        repo.write("deleted.rs", "fn deleted() {}\n");
        repo.git(&["add", "."]);
        repo.git(&["commit", "-m", "Base"]);
        repo.git(&["checkout", "-b", "feature"]);
        repo.write(
            "source.rs",
            "fn value() -> u32 { 2 }\nlet password = 'fixture-only';\n",
        );
        repo.write(".env", "VERY_PRIVATE=fixture-only\n");
        repo.git(&["rm", "deleted.rs"]);
        repo.git(&["add", "."]);
        repo.git(&["commit", "-m", "Feature"]);
        repo
    }
    pub fn git(&self, args: &[&str]) -> String {
        let output = std::process::Command::new("git")
            .current_dir(&self.path)
            .args([
                "-c",
                "commit.gpgsign=false",
                "-c",
                "core.hooksPath=",
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
            "{args:?}: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        String::from_utf8(output.stdout).unwrap()
    }
    pub fn write(&self, path: &str, content: &str) {
        std::fs::write(self.path.join(path), content).unwrap();
    }
    pub fn path(&self) -> &str {
        self.path.to_str().unwrap()
    }
    pub fn review(&self) -> (super::ReviewRun, super::context::ReviewContext) {
        let guards =
            std::sync::Arc::new(crate::features::sandbox::guardrails::GuardrailsEngine::new());
        let snapshot = super::context::capture(self.path(), "main", "feature", &guards).unwrap();
        let run = super::ReviewRun {
            id: uuid::Uuid::new_v4().to_string(),
            session_id: "session".into(),
            provider: "ollama".into(),
            model: "fixture".into(),
            reviewer_id: None,
            reviewer_name: None,
            endpoint: "http://localhost/api/chat".into(),
            snapshot: snapshot.clone(),
            status: "running".into(),
            summary: String::new(),
            error: None,
            findings: vec![],
            inspected_files: vec![],
            turns: 0,
            tool_calls: 0,
            usage_tokens: 0,
            context_bytes: 0,
            started_at: chrono::Utc::now().to_rfc3339(),
            finished_at: None,
            published: false,
            prompt_version: "fixture".into(),
        };
        (run, super::context::ReviewContext::new(snapshot, guards))
    }
}

impl Drop for TestRepo {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.path);
    }
}
