use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowChrome {
    pub platform: String,
    pub desktop: String,
    pub session: String,
    pub native_frame: bool,
    pub controls_left: Vec<String>,
    pub controls_right: Vec<String>,
    pub double_click_action: String,
}

impl Default for WindowChrome {
    fn default() -> Self {
        Self {
            platform: std::env::consts::OS.into(),
            desktop: "unknown".into(),
            session: "unknown".into(),
            native_frame: false,
            controls_left: Vec::new(),
            controls_right: ["minimize", "maximize", "close"].map(String::from).to_vec(),
            double_click_action: "maximize".into(),
        }
    }
}
