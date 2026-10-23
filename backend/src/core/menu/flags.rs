#[derive(Clone, Default, serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MenuFlags {
    pub repository: bool,
    pub file: bool,
    pub text_file: bool,
    pub idle: bool,
    pub rebasing: bool,
    pub recents: bool,
    pub split: bool,
    pub unified: bool,
    pub blame: bool,
    pub inline_blame: bool,
    pub flat: bool,
    pub tree: bool,
    pub performance: bool,
}

impl MenuFlags {
    pub fn value(&self, key: &str) -> bool {
        match key {
            "repository" => self.repository,
            "file" => self.repository && self.file,
            "textFile" => self.repository && self.file && self.text_file,
            "idle" => self.idle,
            "rebasing" => self.rebasing,
            "recents" => self.recents,
            "split" => self.split,
            "unified" => self.unified,
            "blame" => self.blame,
            "inlineBlame" => self.inline_blame,
            "flat" => self.flat,
            "tree" => self.tree,
            "performance" => self.performance,
            _ => false,
        }
    }

    pub fn enabled(&self, requires: &[String]) -> bool {
        requires.iter().all(|key| self.value(key))
    }
}
