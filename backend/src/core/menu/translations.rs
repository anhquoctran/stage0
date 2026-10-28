pub(crate) fn localized_menu_label(key: &str, language: &str, platform: &str) -> String {
    let label = crate::core::i18n::translate(key, language);
    super::definition::label(&label, platform)
}
