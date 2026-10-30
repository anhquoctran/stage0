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
            .map_err(|_| crate::common::messages::code("backend.acp.archiveUrlInvalid"))?;
        if url.scheme() != "https"
            || !url.username().is_empty()
            || url.password().is_some()
            || url.fragment().is_some()
        {
            return Err(crate::common::messages::code("backend.acp.archiveUrlUnsafe").into());
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
            Err(crate::common::messages::code("backend.acp.archiveUnsupported").into())
        } else {
            Ok(Self::Raw)
        }
    }
}
