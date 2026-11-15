use super::model::{normalize, LocalEmbedder};

#[test]
fn embeddings_are_normalized_and_invalid_vectors_are_rejected() {
    let values = normalize(vec![3., 4.]).unwrap();
    assert!((values[0] - 0.6).abs() < 1e-6);
    assert!((values[1] - 0.8).abs() < 1e-6);
    assert!(normalize(vec![0.; 384]).is_err());
    assert!(normalize(vec![f32::NAN; 384]).is_err());
    assert!(LocalEmbedder::load(std::path::Path::new("/not-an-installed-stage0-model")).is_err());
    // Optional public-model smoke check. All baseline assertions above run even
    // offline; the normal test suite never downloads weights or contacts APIs.
    if let Some(root) = std::env::var_os("STAGE0_EMBEDDING_TEST_MODEL") {
        let model = LocalEmbedder::load(std::path::Path::new(&root)).unwrap();
        let query = model.embed("How is the user authenticated?", true).unwrap();
        assert_eq!(query.len(), 384);
        assert!((query.iter().map(|v| v * v).sum::<f32>() - 1.).abs() < 1e-4);
        let auth = model
            .embed(
                "Authenticate the user by verifying the password before creating a session.",
                false,
            )
            .unwrap();
        let unrelated = model
            .embed("Draw the blue toolbar and resize the window.", false)
            .unwrap();
        let score = |v: Vec<f32>| query.iter().zip(v).map(|(a, b)| a * b).sum::<f32>();
        assert!(score(auth) > score(unrelated));
        assert!(model.embed(&"identifier ".repeat(1000), false).is_err());
        assert!(!model
            .chunks("fn authenticate() {}\nfn render() {}\n")
            .is_empty());
    }
}
