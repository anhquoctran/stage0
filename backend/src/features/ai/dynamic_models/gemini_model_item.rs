use serde::Deserialize;

#[derive(Deserialize)]
pub(super) struct GeminiModelItem {
    pub(super) name: String,
    #[serde(rename = "displayName")]
    pub(super) display_name: Option<String>,
    #[serde(rename = "supportedGenerationMethods")]
    pub(super) supported_generation_methods: Option<Vec<String>>,
}
