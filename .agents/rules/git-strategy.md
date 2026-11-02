# Git Strategy & Branching Rule

- **Branch risk & stability hierarchy**:
  - `develop` / `feat/*` / `fix/*` (and working branches): **Highest risk**, least stable (`unstable`).
  - `nightly` (`origin/nightly`): **High risk** (`preview`).
  - `beta` (`origin/beta`): **Medium risk** (`stabilizing`).
  - `main` (`origin/main`): **Stable** (`low` risk production release). `main` là bản chính thức có độ ổn định cao nhất; có thể không phải là bản có SemVer lớn nhất tại một thời điểm (do preview channels liên tục ra bản mới), nhưng luôn là bản chính thức được phát hành cho người dùng.
- **Protected branches (`main`, `beta`, `nightly`, `develop`)**: Never commit directly to, push directly to, or force-push any of the main build or integration branches (`origin/main`, `origin/beta`, `origin/nightly`, `origin/develop`).
- **Standard work (`feat/*`, `fix/*`, `refactor/*`, `perf/*`, `docs/*`, `test/*`, `chore/*`)**:
  1. Always branch off `origin/develop` (`git checkout -b <type>/<slug> origin/develop`).
  2. Run all required verification checks before pushing.
  3. Push the working branch and open a Pull Request into `develop`.
- **Hotfix exception (`hotfix/*`)**:
  1. When fixing an urgent issue on a release branch (`main`, `beta`, or `nightly`), branch directly off that target branch (`git checkout -b hotfix/<target>/<slug> origin/<target>`).
  2. Open the primary Pull Request into `<target>`.
  3. **Mandatory synchronization**: Immediately synchronize the hotfix into all remaining downstream branches (`main` -> `beta`, `nightly`, `develop`; `beta` -> `nightly`, `develop`; `nightly` -> `develop`) via back-merge or cherry-pick PRs.
- See `docs/architecture/git_strategy.md` and `shared/release-channels.json` (`gitFlow`) for the canonical specification.
