use serde::de::DeserializeOwned;

pub(super) fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| "Could not initialize the OpenAI sign-in client".into())
}
pub(super) async fn json<T: DeserializeOwned>(response: reqwest::Response) -> Result<T, String> {
    if !response.status().is_success() {
        return Err(format!(
            "OpenAI sign-in request failed (HTTP {}). No raw server payload was retained.",
            response.status().as_u16()
        ));
    }
    let bytes = body(response, 256 * 1024).await?;
    serde_json::from_slice(&bytes).map_err(|_| "OpenAI sign-in returned an invalid response".into())
}
pub(super) async fn body(
    mut response: reqwest::Response,
    limit: usize,
) -> Result<zeroize::Zeroizing<Vec<u8>>, String> {
    let mut bytes = zeroize::Zeroizing::new(Vec::new());
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "OpenAI sign-in response was interrupted")?
    {
        if bytes.len() + chunk.len() > limit {
            return Err("OpenAI sign-in response exceeded its size limit".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}
