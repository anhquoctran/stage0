mod catalog;
mod shortcut;
#[cfg(test)]
mod tests;
mod validation;

pub use validation::validate_settings;

pub fn validate_native_shortcut(key: &str) -> Result<(), String> {
    shortcut::normalize(key, true).map(|_| ())
}
