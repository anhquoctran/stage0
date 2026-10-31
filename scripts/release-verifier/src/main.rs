//! Offline release gate; uses the same Minisign verifier as Tauri's updater.
use base64::{engine::general_purpose::STANDARD, Engine};
use minisign_verify::{PublicKey, Signature};
use serde_json::Value;
use std::{error::Error, fs, path::Path};

fn main() -> Result<(), Box<dyn Error>> {
    let arguments = std::env::args().skip(1).collect::<Vec<_>>();
    let config: Value = serde_json::from_slice(&fs::read("backend/tauri.conf.json")?)?;
    let key = config["plugins"]["updater"]["pubkey"]
        .as_str()
        .ok_or("Missing updater public key")?;
    let key = String::from_utf8(STANDARD.decode(key)?)?;
    let key = PublicKey::decode(&key)?;
    if let [flag, package, version] = arguments.as_slice() {
        if flag != "--package" {
            return Err("Use --package PATH VERSION".into());
        }
        let bytes = fs::read(package)?;
        let signature = fs::read_to_string(format!("{package}.sig"))?;
        verify_package(&key, &bytes, signature.trim(), version)?;
        println!("Verified signed package for version {version}: {package}");
        return Ok(());
    }
    let [directory] = arguments.as_slice() else {
        return Err("Pass an asset directory, or --package PATH VERSION".into());
    };
    let manifest: Value =
        serde_json::from_slice(&fs::read(Path::new(directory).join("latest.json"))?)?;
    let version = manifest["version"]
        .as_str()
        .ok_or("Missing release version")?;
    let platforms = manifest["platforms"]
        .as_object()
        .ok_or("Missing release platforms")?;
    const REQUIRED_PLATFORMS: [&str; 13] = [
        "linux-x86_64-appimage",
        "linux-x86_64-deb",
        "linux-x86_64-rpm",
        "linux-aarch64-deb",
        "linux-aarch64-rpm",
        "windows-x86_64-nsis",
        "windows-aarch64-nsis",
        "darwin-aarch64-app",
        "darwin-x86_64-app",
        "linux-x86_64",
        "windows-x86_64",
        "darwin-aarch64",
        "darwin-x86_64",
    ];
    if platforms.len() != REQUIRED_PLATFORMS.len()
        || REQUIRED_PLATFORMS
            .iter()
            .any(|platform| !platforms.contains_key(*platform))
    {
        return Err("Expected all required architecture and installer update targets".into());
    }
    for (platform, package) in platforms {
        let url = package["url"].as_str().ok_or("Missing package URL")?;
        let file = url
            .rsplit('/')
            .next()
            .filter(|name| !name.is_empty())
            .ok_or("Missing asset name")?;
        // Collector-generated asset names have only ASCII letters, digits, '.', '_' and '-'.
        if !file
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || b"._-".contains(&byte))
        {
            return Err("Unexpected release asset name".into());
        }
        let path = Path::new(&directory).join(file);
        if fs::metadata(&path)?.len() > 512 * 1024 * 1024 {
            return Err("Release package exceeds download limit".into());
        }
        let bytes = fs::read(path)?;
        let signature = package["signature"].as_str().ok_or("Missing signature")?;
        verify_package(&key, &bytes, signature, version)?;
        println!("Verified {platform}: {file}");
    }
    Ok(())
}

fn verify_package(
    key: &PublicKey,
    bytes: &[u8],
    signature: &str,
    version: &str,
) -> Result<(), Box<dyn Error>> {
    let decoded = String::from_utf8(STANDARD.decode(signature)?)?;
    let signature = Signature::decode(&decoded)?;
    key.verify(bytes, &signature, true)?;
    let expected = format!("version:{version}");
    if !signature
        .trusted_comment()
        .split('\t')
        .any(|field| field == expected)
    {
        return Err("Signed version does not match manifest".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn release_gate_rejects_tampered_bytes_and_replayed_versions() {
        let encoded_key =
            include_str!("../../../backend/src/features/updates/fixtures/test.pub").trim();
        let signature =
            include_str!("../../../backend/src/features/updates/fixtures/payload.sig").trim();
        let decoded_key = String::from_utf8(STANDARD.decode(encoded_key).unwrap()).unwrap();
        let key = PublicKey::decode(&decoded_key).unwrap();
        assert!(verify_package(&key, b"stage0-updater-test-payload", signature, "2.0.0").is_ok());
        assert!(verify_package(&key, b"tampered-package", signature, "2.0.0").is_err());
        assert!(verify_package(&key, b"stage0-updater-test-payload", signature, "99.0.0").is_err());
        assert!(verify_package(&key, b"stage0-updater-test-payload", "invalid", "2.0.0").is_err());
    }
}
