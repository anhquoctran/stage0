// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let args = std::env::args().skip(1).collect::<Vec<_>>();
    if args.first().map(String::as_str) == Some("--stage0-git-credential-helper") {
        let exit_code = match args.as_slice() {
            [_, token_ref, expected_origin, username, operation] => {
                stage0_lib::features::credentials::run_git_credential_helper(
                    token_ref,
                    expected_origin,
                    username,
                    operation,
                )
            }
            _ => 1,
        };
        std::process::exit(exit_code);
    }

    stage0_lib::run();
}
