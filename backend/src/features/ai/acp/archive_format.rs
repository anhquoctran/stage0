#[derive(Clone, Copy, Debug, PartialEq)]
pub enum ArchiveFormat {
    Zip,
    TarGz,
    TarBz2,
    Raw,
}

impl ArchiveFormat {
    pub fn from_url(value: &str) -> Result<Self, String> {
        let url = reqwest::Url::parse(value)
            .map_err(|_| "ACP Registry returned an invalid download URL")?;
        if url.scheme() != "https"
            || !url.username().is_empty()
            || url.password().is_some()
            || url.fragment().is_some()
        {
            return Err(
                "ACP Registry binary downloads must use an HTTPS URL without credentials".into(),
            );
        }
        let path = url.path().to_ascii_lowercase();
        if path.ends_with(".zip") {
            Ok(Self::Zip)
        } else if path.ends_with(".tar.gz") || path.ends_with(".tgz") {
            Ok(Self::TarGz)
        } else if path.ends_with(".tar.bz2") || path.ends_with(".tbz2") {
            Ok(Self::TarBz2)
        } else if [
            ".dmg",
            ".pkg",
            ".deb",
            ".rpm",
            ".msi",
            ".appimage",
            ".tar",
            ".xz",
            ".7z",
            ".rar",
        ]
        .iter()
        .any(|extension| path.ends_with(extension))
        {
            Err("ACP Registry package uses an unsupported archive or installer format".into())
        } else {
            Ok(Self::Raw)
        }
    }
}
