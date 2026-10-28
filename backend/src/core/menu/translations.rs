use serde_json::Value;
use std::{collections::HashMap, sync::OnceLock};

fn source(code: &str) -> &'static str {
    match code {
        "vi" => include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../frontend/features/i18n/locales/vi.json"
        )),
        "ja" => include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../frontend/features/i18n/locales/ja.json"
        )),
        "ko" => include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../frontend/features/i18n/locales/ko.json"
        )),
        "zh-Hans" => include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../frontend/features/i18n/locales/zh-Hans.json"
        )),
        "es" => include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../frontend/features/i18n/locales/es.json"
        )),
        "pt-BR" => include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../frontend/features/i18n/locales/pt-BR.json"
        )),
        "de" => include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../frontend/features/i18n/locales/de.json"
        )),
        "fr" => include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../frontend/features/i18n/locales/fr.json"
        )),
        "ru" => include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../frontend/features/i18n/locales/ru.json"
        )),
        "zh-Hant" => include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../frontend/features/i18n/locales/zh-Hant.json"
        )),
        "it" => include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../frontend/features/i18n/locales/it.json"
        )),
        "pt-PT" => include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../frontend/features/i18n/locales/pt-PT.json"
        )),
        "ar" => include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../frontend/features/i18n/locales/ar.json"
        )),
        _ => include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../frontend/features/i18n/locales/en.json"
        )),
    }
}

fn catalogs() -> &'static HashMap<&'static str, Value> {
    static CATALOGS: OnceLock<HashMap<&'static str, Value>> = OnceLock::new();
    CATALOGS.get_or_init(|| {
        [
            "en", "vi", "ja", "ko", "zh-Hans", "es", "pt-BR", "de", "fr", "ru", "zh-Hant", "it",
            "pt-PT", "ar",
        ]
        .into_iter()
        .map(|code| {
            (
                code,
                serde_json::from_str(source(code)).expect("bundled locale JSON is valid"),
            )
        })
        .collect()
    })
}

pub(crate) fn localized_menu_label(key: &str, language: &str, platform: &str) -> String {
    let pointer = format!("/{}", key.split('.').collect::<Vec<_>>().join("/"));
    let value = catalogs()
        .get(language)
        .and_then(|catalog| catalog.pointer(&pointer))
        .or_else(|| {
            catalogs()
                .get("en")
                .and_then(|catalog| catalog.pointer(&pointer))
        })
        .and_then(Value::as_str)
        .unwrap_or(key);
    super::definition::label(value, platform)
}
