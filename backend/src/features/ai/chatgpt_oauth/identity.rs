use super::id_claims::IdClaims;
use jsonwebtoken::{decode, decode_header, jwk::JwkSet, Algorithm, DecodingKey, Validation};

pub(super) fn verify(
    token: &str,
    keys: &JwkSet,
    client_id: &str,
    nonce: Option<&str>,
    algorithms: &[String],
) -> Result<IdClaims, String> {
    let failure = || "OpenAI identity verification failed. No session was activated.".to_string();
    if token.len() > 32 * 1024 {
        return Err(failure());
    }
    let header = decode_header(token).map_err(|_| failure())?;
    if !matches!(
        header.alg,
        Algorithm::RS256
            | Algorithm::RS384
            | Algorithm::RS512
            | Algorithm::ES256
            | Algorithm::ES384
            | Algorithm::EdDSA
    ) || !algorithms.iter().any(|a| a == &format!("{:?}", header.alg))
    {
        return Err(failure());
    }
    let kid = header.kid.as_deref().ok_or_else(failure)?;
    let key = keys.find(kid).ok_or_else(failure)?;
    if key
        .common
        .key_algorithm
        .is_some_and(|alg| alg.to_string() != format!("{:?}", header.alg))
    {
        return Err(failure());
    }
    if key
        .common
        .public_key_use
        .as_ref()
        .is_some_and(|usage| *usage != jsonwebtoken::jwk::PublicKeyUse::Signature)
    {
        return Err(failure());
    }
    let decoding = DecodingKey::from_jwk(key).map_err(|_| failure())?;
    if key
        .common
        .key_operations
        .as_ref()
        .is_some_and(|operations| !operations.contains(&jsonwebtoken::jwk::KeyOperations::Verify))
    {
        return Err(failure());
    }
    let mut validation = Validation::new(header.alg);
    validation.set_audience(&[client_id]);
    validation.set_issuer(&[super::ISSUER]);
    validation.set_required_spec_claims(&["exp", "iss", "aud", "sub"]);
    validation.leeway = 30;
    validation.validate_nbf = true;
    let claims = decode::<IdClaims>(token, &decoding, &validation)
        .map_err(|_| failure())?
        .claims;
    if claims.sub.is_empty()
        || claims.sub.len() > 256
        || claims.sub.chars().any(char::is_control)
        || claims.iat > chrono::Utc::now().timestamp() + 30
        || nonce.is_some_and(|value| claims.nonce.as_deref() != Some(value))
        || claims
            .azp
            .as_deref()
            .is_some_and(|value| value != client_id)
        || claims
            .aud
            .as_array()
            .is_some_and(|values| values.len() > 1 && claims.azp.as_deref() != Some(client_id))
    {
        return Err(failure());
    }
    Ok(claims)
}
pub(super) async fn fetch_and_verify(
    client: &reqwest::Client,
    discovery: &super::discovery::Discovery,
    token: &str,
    client_id: &str,
    nonce: Option<&str>,
) -> Result<IdClaims, String> {
    let response = client
        .get(&discovery.jwks_uri)
        .send()
        .await
        .map_err(|_| "Could not load OpenAI signing keys")?;
    let keys: JwkSet = super::http::json(response).await?;
    verify(
        token,
        &keys,
        client_id,
        nonce,
        &discovery.id_token_signing_alg_values_supported,
    )
}
