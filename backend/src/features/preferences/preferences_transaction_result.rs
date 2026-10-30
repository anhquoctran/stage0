use super::PreferencesDocument;
use serde::Serialize;
use std::collections::BTreeMap;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreferencesTransactionResult {
    pub document: PreferencesDocument,
    pub configured: BTreeMap<String, bool>,
}
