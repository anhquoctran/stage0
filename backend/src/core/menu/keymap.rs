use super::definition::{definition, label};
use std::collections::HashMap;

#[derive(Clone, Default)]
pub struct NativeMenuKeymap {
    pub accelerators: HashMap<String, String>,
    pub labels: HashMap<String, String>,
}

impl NativeMenuKeymap {
    pub fn from_input(
        accelerators: HashMap<String, String>,
        labels: HashMap<String, String>,
    ) -> Result<Self, String> {
        if accelerators.len() > 256 || labels.len() > 256 {
            return Err("Native menu keymap exceeds its entry limit".into());
        }
        for (id, key) in &accelerators {
            let command = definition()
                .commands
                .get(id)
                .ok_or("Unknown native menu command")?;
            if command.native.is_some()
                || !key.contains('+')
                || key.contains(' ')
                || key.len() > 128
            {
                return Err("Unsupported native menu accelerator".into());
            }
            // The frontend uses a bounded portable syntax; validate it before handing it to AppKit.
            crate::core::keymaps::validate_native_shortcut(key)?;
        }
        for (id, text) in &labels {
            if !definition().commands.contains_key(id) {
                return Err("Unknown native menu command label".into());
            }
            if text.len() > 256 || text.chars().any(char::is_control) {
                return Err("Invalid native menu shortcut label".into());
            }
        }
        Ok(Self {
            accelerators,
            labels,
        })
    }

    pub fn title(&self, id: &str) -> String {
        let title = label(&definition().commands[id].label, "macos");
        // Chords/context-specific shortcuts are executed by the WebView, not AppKit.
        // Keep their resolved primary binding visible without registering a second owner.
        match self
            .labels
            .get(id)
            .filter(|text| !text.is_empty() && !self.accelerators.contains_key(id))
        {
            Some(keys) => format!("{title}  ({keys})"),
            None => title,
        }
    }
}
