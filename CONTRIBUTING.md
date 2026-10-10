# Contributing to Stage0

Thank you for your interest in contributing to **Stage0**! We welcome community contributions of all kinds: bug fixes, feature proposals, documentation improvements, and UI refinements.

Please take a few moments to review these guidelines before submitting a pull request.

---

## Code of Conduct

By participating in this project, you agree to uphold our [Code of Conduct](./CODE_OF_CONDUCT.md). Please treat all contributors with respect and empathy.

---

## Getting Started

### Prerequisites

To work on Stage0 locally, you will need:
- **Git** (v2.38+)
- **Node.js** (v18.0.0 or higher) and `npm`
- **Rust** (stable toolchain, 2021 edition)
- Platform-specific native build tools:
  - **Windows**: Microsoft C++ Build Tools
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Linux**: WebKit2GTK and related build packages (see [README.md](./README.md#prerequisites))

### Local Setup

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/<your-username>/stage0.git
   cd stage0
   ```

2. **Install frontend dependencies:**
   ```bash
   pnpm install
   ```

3. **Start the local development environment:**
   ```bash
   pnpm run dev:app
   ```
   *This starts the Vite dev server and opens the native Tauri application with live reload enabled.*

---

## Development Workflow

### Branching Strategy

Create a descriptive feature branch from `main`:

```bash
git checkout -b feat/your-feature-name
# or
git checkout -b fix/your-bugfix-name
```

Common prefixes:
- `feat/`: New user-facing features or capabilities
- `fix/`: Bug fixes
- `perf/`: Performance optimizations
- `docs/`: Documentation updates
- `refactor/`: Code reorganization without functional changes
- `chore/`: Dependency updates, tooling, and build scripts

---

## Coding Standards

### Frontend (React 19, TypeScript, Tailwind CSS v4)
- **One Source Owner per File**: Declare at most one named component, class, interface, enum, or type alias in each source file. Extract props and state into individually named files in the owning feature's `types/` directory. Helpers may accompany their owner; shared helpers belong in `utils/`. Import directly from the owning file. Re-export-only compatibility barrels are allowed, but must not define additional objects.
- **Strict Typing**: Maintain strict TypeScript typing. Avoid `any`; keep feature-specific interfaces in `frontend/features/<feature>/types/`.
- **Monochromatic & Accessible Design**:
  - Adhere to the Catppuccin-inspired monochromatic aesthetic (`text-subtext0`, `text-subtext1`, `text-text`, `bg-mantle`, `bg-surface0`, `bg-surface1`).
  - Avoid ad-hoc saturated accent colors in menus, context actions, or toolbars unless specifically required for git diff semantics (additions in green, deletions in red).
- **Component Cleanliness**:
  - Keep components modular and reusable.
  - Follow keyboard shortcut accessibility patterns (<kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + keys).

### Backend (Rust, Tauri v2)
- **One Source Owner per File**: Put each struct, enum, trait, or type alias in its own snake_case module. Keep its inherent and trait `impl` blocks with that owner. Feature persistence modules may retain extension `impl Database` blocks. Use `mod` and explicit re-exports to preserve feature APIs; `mod.rs` and function-only orchestration files may contain no model declarations. Keep private implementation details restricted to their original parent module with `pub(super)` when required.
- **Safe Subprocess Execution**:
  - Always execute Git commands using `std::process::Command` with sanitized arguments.
  - Do not use shell string interpolation (`sh -c` or `cmd /c`) unless explicitly launching detached terminal applications.
- **In-Memory Non-Destructive Principles**:
  - Merge simulations and conflict predictions must use in-memory commands like `git merge-tree --write-tree`.
  - Never modify `.git/index` or user working tree files during review or diff computations.
- **Error Handling**:
  - Return clear, actionable error messages in `Result<T, String>` for all Tauri IPC commands.

---

## Verification & Testing

Before submitting your changes, ensure that all static checks pass:

Run `pnpm check:architecture` to enforce source ownership across FE and BE. This check also runs as part of `pnpm test`.

This is a project organization convention, not a definition of SOLID. It follows TypeScript's [module boundaries](https://www.typescriptlang.org/docs/handbook/2/modules.html) and Rust's [file-backed modules](https://doc.rust-lang.org/book/ch07-05-separating-modules-into-different-files.html) and [visibility/re-exports](https://doc.rust-lang.org/book/ch07-03-paths-for-referring-to-an-item-in-the-module-tree.html).

1. **Typecheck Frontend:**
   ```bash
   pnpm run typecheck
   ```

2. **Check Rust Backend:**
   ```bash
   cd backend && cargo check
   ```

3. **Build Bundle:**
   ```bash
   pnpm run build
   ```

---

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

Examples:
- `feat(blame): add inline git blame annotations to diff lines`
- `fix(ui): fix split button alignment and hover padding on topbar`
- `docs(readme): add installation guide for Linux distributions`

---

## Submitting a Pull Request

1. Push your branch to your GitHub fork:
   ```bash
   git push origin feat/your-feature-name
   ```
2. Open a Pull Request against the `main` branch of `anhquoctran/stage0`.
3. Provide a clear description of the problem solved, changes made, and include screenshots or GIFs for UI updates.
4. Respond promptly to any reviewer feedback.

Thank you for helping make Stage0 better for everyone!
