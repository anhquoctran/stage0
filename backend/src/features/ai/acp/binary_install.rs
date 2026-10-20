use super::{
    archive_format::ArchiveFormat, binary_archive, binary_download, binary_platform,
    AcpAgentConfig, AcpRegistryAgent,
};
use serde_json::Value;
use std::path::{Path, PathBuf};

pub async fn install(data_dir: &Path, agent: AcpRegistryAgent) -> Result<AcpAgentConfig, String> {
    let target = binary_platform::current_target()
        .ok_or("ACP binary packages require Windows, macOS or Linux")?;
    let binary = select_binary(&agent.distribution, &target)?;
    let archive_url = binary
        .get("archive")
        .and_then(Value::as_str)
        .ok_or("ACP Registry binary has no download URL")?;
    let format = ArchiveFormat::from_url(archive_url)?;
    let relative_command = binary_platform::relative_command(
        binary
            .get("cmd")
            .and_then(Value::as_str)
            .ok_or("ACP Registry binary has no launch command")?,
        &target,
    )?;
    let args = parse_registry_binary_args(binary.get("args"))?;
    let checksum = binary
        .get("sha256")
        .map(|value| {
            value
                .as_str()
                .ok_or("ACP Registry binary SHA-256 checksum is invalid")
        })
        .transpose()?;
    // Also validate IDs here: this helper must never turn registry data into
    // an arbitrary path, even when invoked outside the command wrapper.
    if agent.id.is_empty()
        || agent.id.len() > 100
        || !agent
            .id
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
    {
        return Err("Invalid ACP Registry agent ID".into());
    }
    let agent_dir = data_dir.join("external-agents").join(&agent.id);
    tokio::fs::create_dir_all(&agent_dir)
        .await
        .map_err(|_| "Could not create the ACP agent install directory")?;
    let install_dir = agent_dir.join(format!("install-{}", uuid::Uuid::new_v4()));
    let staging_dir = agent_dir.join(format!(".stage-{}", uuid::Uuid::new_v4()));
    tokio::fs::create_dir(&staging_dir)
        .await
        .map_err(|_| "Could not create the ACP agent staging directory")?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if tokio::fs::set_permissions(&staging_dir, std::fs::Permissions::from_mode(0o700))
            .await
            .is_err()
        {
            let _ = tokio::fs::remove_dir(&staging_dir).await;
            return Err("Could not secure the ACP staging directory".into());
        }
    }
    let archive = staging_dir.join("download");
    let extracted = staging_dir.join("extracted");
    let result: Result<PathBuf, String> = async {
        tokio::fs::create_dir(&extracted)
            .await
            .map_err(|_| "Could not prepare the ACP agent extraction directory")?;
        binary_download::download(archive_url, &archive, checksum).await?;
        let (archive, extracted_copy, command, target) = (
            archive.clone(),
            extracted.clone(),
            relative_command.clone(),
            target.clone(),
        );
        tokio::task::spawn_blocking(move || {
            binary_archive::extract(&archive, &extracted_copy, format, &command, &target)
        })
        .await
        .map_err(|_| "ACP package extraction failed")??;
        tokio::fs::rename(&extracted, &install_dir)
            .await
            .map_err(|_| "Could not finalize the ACP agent installation")?;
        Ok(install_dir.join(&relative_command))
    }
    .await;
    // Only the generated staging directory is removed; existing installations
    // remain available if downloading, validation or extraction fails.
    let _ = tokio::fs::remove_dir_all(&staging_dir).await;
    let command = result?;
    Ok(AcpAgentConfig {
        id: agent.id,
        name: agent.name,
        version: Some(agent.version),
        description: Some(agent.description),
        source: "registry".into(),
        command: command.to_string_lossy().into_owned(),
        launch_mode: Some("binary".into()),
        args,
    })
}

fn select_binary<'a>(distribution: &'a Value, target: &str) -> Result<&'a Value, String> {
    distribution
        .get("binary")
        .and_then(|value| value.get(target))
        .ok_or_else(|| format!("The publisher has not provided an ACP binary package for {target}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn selects_exact_architecture_and_never_substitutes_a_foreign_binary() {
        let mut binary = serde_json::Map::new();
        for target in [
            "darwin-aarch64",
            "darwin-x86_64",
            "linux-aarch64",
            "linux-x86_64",
            "windows-aarch64",
            "windows-x86_64",
            "linux-arm",
            "windows-x86",
        ] {
            binary.insert(target.into(), json!({"cmd":target}));
        }
        let distribution = json!({"binary":binary});
        for target in binary.keys() {
            assert_eq!(
                select_binary(&distribution, target).unwrap()["cmd"],
                target.as_str()
            );
        }
        assert!(select_binary(&distribution, "linux-riscv64")
            .unwrap_err()
            .contains("linux-riscv64"));
        assert!(select_binary(&json!({"binary":{"darwin-x86_64":{}}}), "darwin-aarch64").is_err());
    }
}

fn parse_registry_binary_args(value: Option<&Value>) -> Result<Vec<String>, String> {
    let Some(value) = value else {
        return Ok(Vec::new());
    };
    let args = value
        .as_array()
        .ok_or("ACP Registry binary args are invalid")?;
    if args.len() > 64 {
        return Err("ACP Registry binary has too many launch arguments".into());
    }
    args.iter()
        .map(|arg| {
            let arg = arg
                .as_str()
                .ok_or("ACP Registry binary argument is invalid")?;
            if arg.len() > 2048 || arg.chars().any(char::is_control) {
                return Err("ACP Registry binary argument is invalid".into());
            }
            Ok(arg.to_owned())
        })
        .collect()
}
