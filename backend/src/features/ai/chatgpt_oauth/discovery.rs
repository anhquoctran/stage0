use serde::Deserialize;

#[derive(Deserialize)]
pub(super) struct Discovery {
    pub issuer: String,
    pub authorization_endpoint: String,
    pub token_endpoint: String,
    pub jwks_uri: String,
    pub revocation_endpoint: Option<String>,
    pub id_token_signing_alg_values_supported: Vec<String>,
}
impl Discovery {
    pub async fn fetch(client: &reqwest::Client) -> Result<Self, String> {
        let response = client
            .get(format!(
                "{}/.well-known/openid-configuration",
                super::ISSUER
            ))
            .send()
            .await
            .map_err(|_| crate::common::messages::code("backend.ai.chatgptDiscoveryFailed"))?;
        let value: Self = super::http::json(response).await?;
        if value.issuer != super::ISSUER
            || value.authorization_endpoint != format!("{}/api/accounts/authorize", super::ISSUER)
            || value.token_endpoint != format!("{}/api/accounts/oauth/token", super::ISSUER)
        {
            return Err(crate::common::messages::code(
                "backend.ai.chatgptUnexpectedIssuer",
            ));
        }
        Self::trusted_url(&value.jwks_uri)?;
        if let Some(url) = &value.revocation_endpoint {
            Self::trusted_url(url)?;
        }
        Ok(value)
    }
    pub fn trusted_url(value: &str) -> Result<(), String> {
        let url = reqwest::Url::parse(value)
            .map_err(|_| crate::common::messages::code("backend.ai.chatgptInvalidAuthEndpoint"))?;
        if url.scheme() != "https"
            || url.host_str() != Some("auth.openai.com")
            || url.port().is_some()
            || !url.username().is_empty()
            || url.password().is_some()
            || url.query().is_some()
            || url.fragment().is_some()
        {
            return Err(crate::common::messages::code(
                "backend.ai.chatgptUntrustedAuthEndpoint",
            ));
        }
        Ok(())
    }
}
