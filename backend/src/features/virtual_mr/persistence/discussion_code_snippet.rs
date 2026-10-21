#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DiscussionCodeSnippet {
    pub start_line: i64,
    #[serde(default)]
    pub selected_line: Option<i64>,
    pub lines: Vec<String>,
}
