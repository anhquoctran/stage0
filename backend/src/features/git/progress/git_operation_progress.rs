#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitOperationProgress {
    pub phase: String,
    pub percent: Option<f64>,
    pub message: String,
}
