pub(crate) const SUPPORTED_APP_LANGUAGES: [&str; 14] = [
    "en", "vi", "ja", "ko", "zh-Hans", "es", "pt-BR", "de", "fr", "ru", "zh-Hant", "it", "pt-PT",
    "ar",
];

pub(crate) const DEFAULT_APP_LANGUAGE: &str = "vi";
pub(crate) const DEFAULT_AGENT_OUTPUT_LANGUAGE: &str = "follow-app";

pub(crate) fn is_supported_app_language(language: &str) -> bool {
    SUPPORTED_APP_LANGUAGES.contains(&language)
}

pub(crate) fn is_supported_agent_output_language(language: &str) -> bool {
    language == DEFAULT_AGENT_OUTPUT_LANGUAGE || is_supported_app_language(language)
}
