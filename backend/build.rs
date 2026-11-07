fn main() {
    tauri_build::build();
    // Tauri's Windows resource is linked into application binaries, not lib
    // unit tests. Scope this Common Controls v6 manifest to explicit test runs.
    // Package builds disable this flag and Cargo reruns the script accordingly.
    println!("cargo:rerun-if-env-changed=STAGE0_RUST_TEST_MANIFEST");
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows")
        && std::env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("msvc")
        && std::env::var("STAGE0_RUST_TEST_MANIFEST").as_deref() == Ok("1")
    {
        let manifest =
            std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("test-windows.manifest.xml");
        println!("cargo:rerun-if-changed={}", manifest.display());
        println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
        println!("cargo:rustc-link-arg=/MANIFESTINPUT:{}", manifest.display());
    }
}
