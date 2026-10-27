#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DiscussionCodeSnippet {
    pub start_line: i64,
    #[serde(default)]
    pub selected_line: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub selected_end_line: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub format: Option<String>,
    pub lines: Vec<String>,
}
