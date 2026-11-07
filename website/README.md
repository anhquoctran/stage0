# Stage0 website

The `website` branch owns GitHub Pages independently of the desktop release
branches. Create website work branches from `origin/website` and target `website`
with their PRs. Do not promote website-only work through Develop, Nightly, Beta,
or Main. This is the website-specific exception to the application's Git flow.

Run `pnpm --dir website install --frozen-lockfile`, then
`pnpm --dir website test` and `pnpm --dir website build`.
The website has its own dependency manifest and lockfile. The build output is
`dist/website`; the root build entry point delegates to the website builder.

`Website checks and Pages` runs only for PRs targeting `website` and pushes to
`website`. PRs run website tests and bundling on Ubuntu; deployment runs only
after a checked commit reaches `website`. Application regression, Rust and
release promotion workflows target the application's integration branches.

Repository setup: the `github-pages` environment permits the `website` branch,
and the previous `Deploy static content to Pages` workflow is disabled so Main
pushes cannot replace the website. These settings are managed separately from
release branch protections.
