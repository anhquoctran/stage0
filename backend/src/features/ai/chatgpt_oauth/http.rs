use serde::de::DeserializeOwned;

pub(super) fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| crate::common::messages::code("backend.ai.chatgptClientInitFailed"))
}
pub(super) async fn json<T: DeserializeOwned>(response: reqwest::Response) -> Result<T, String> {
    if !response.status().is_success() {
        return Err(crate::common::messages::failure(
            "backend.ai.chatgptRequestFailed",
            serde_json::json!({ "status": response.status().as_u16() }),
            format!(
                "OpenAI sign-in request failed (HTTP {}). No raw server payload was retained.",
                response.status().as_u16()
            ),
        ));
    }
    let bytes = body(response, 256 * 1024).await?;
    serde_json::from_slice(&bytes)
        .map_err(|_| crate::common::messages::code("backend.ai.chatgptInvalidResponse"))
}
pub(super) async fn body(
    mut response: reqwest::Response,
    limit: usize,
) -> Result<zeroize::Zeroizing<Vec<u8>>, String> {
    let mut bytes = zeroize::Zeroizing::new(Vec::new());
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| crate::common::messages::code("backend.ai.chatgptResponseInterrupted"))?
    {
        if bytes.len() + chunk.len() > limit {
            return Err(crate::common::messages::code("backend.ai.chatgptResponseTooLarge"));
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}
