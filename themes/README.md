# Stage0 themes

This directory owns the desktop application's bundled theme CSS and package
metadata. Website styles remain independently owned by `website/`.

```text
themes/
  dark/catppuccin-mocha/{theme.json,theme.css}
  dark/{dracula,one-dark-pro,gruvbox,monokai}/{theme.json,theme.css}
  light/catppuccin-latte/{theme.json,theme.css}
  THIRD_PARTY_NOTICES.md
  shared/                      # scheme rules, syntax roles, legacy adapters
  color-tokens.json            # allowed token → CSS property contract
  theme.schema.json            # package v1 editor schema
  index.css                   # bundled stylesheet entry
```

There are exactly two **kinds**, `dark` and `light`; System is a preference that
chooses a kind using the operating system. Package identity is independent of
kind. Current defaults preserve Stage0's existing Mocha and Latte variants,
including its intentional text, danger, form and diff color adjustments.

## Color layers

- Package CSS supplies the complete bundled palettes and splash colors. These
  trusted styles are loaded before the application paints, through `index.html`,
  and by the application stylesheet. Palette selectors affect the document root,
  so a third-party diff renderer's `data-theme` does not replace the active palette.
- `--theme-*` variables and existing semantic surface/form/diff roles decouple
  components from Catppuccin names. Tailwind color utilities reference these tokens.
- `--syntax-*` roles let a package change highlighting independently of UI accents.
- `shared/compatibility.css` preserves `--ctp-*` aliases. Historical theme IDs,
  classes and localStorage keys remain supported at the runtime boundary.
- Layout, typography, Density, native frames and component behavior stay in the
  frontend's owning stylesheets. Theme data cannot override them.

## Authoring data-only packages

A new package can inherit the default palette for its kind and override selected
color roles without adding selectors or editing component CSS:

```json
{
  "schemaVersion": 1,
  "id": "ocean-night",
  "name": "Ocean Night",
  "kind": "dark",
  "version": "1.0.0",
  "author": "Theme author",
  "colors": {
    "base": "#101c2c",
    "mantle": "#0b1420",
    "crust": "#070e18",
    "text": "#e4edf7",
    "brand": "#2563eb",
    "syntax-keyword": "#b3a2ff"
  }
}
```

Store repository-authored manifests under `dark/<id>/theme.json` or
`light/<id>/theme.json`. Register a bundled manifest in
`frontend/core/themes/catalog.ts`; token overrides take effect through the engine,
so data-only additions need no CSS import or new component conditions. Complete
bundled palettes use CSS imports in `themes/index.css`.
The built-in `colors.base` metadata also supplies its preview swatch.

The public API is `frontend/core/themes/index.ts`:

- `parseThemePackage(text)` bounds input to 32 KiB and validates package v1.
- `ThemeRegistry.register()` validates before mutation, rejects duplicate/reserved
  IDs, copies/freezes records and publishes an immutable catalog snapshot.
- `getTheme()` resolves compatibility aliases and falls back to the built-in Dark
  default for unknown IDs; `themeColorScheme()` classifies viewers by kind.
- `applyRegisteredTheme()` applies validated color values with `style.setProperty`,
  clearing the previous theme's owned overrides first. Font/Density properties
  remain untouched. This also supports transient theme previews.

Only hex and bounded rgb()/rgba() colors are accepted. Unknown properties/tokens,
CSS rules, URLs, fonts, scripts and other schema versions are rejected. The editor
schema is descriptive; the runtime validator is authoritative. Never load an
untrusted `theme.css`, use `innerHTML`, inject package selectors or add scripts.

## Future FE installer boundary

The installer UI, downloads, package disk persistence and uninstall are **not
shipped**. Preferences persists the selected built-in IDs as
`appearance.darkThemeId` and `appearance.lightThemeId`, separately from
`appearance.themeMode`. Dracula, One Dark Pro, Gruvbox Dark and Monokai are
available in the Dark group; Catppuccin Latte remains the bundled Light palette.
These IDs select bundled palettes and do not imply that an external package
installer is available.

The next feature should enumerate installed JSON packages from an app-data theme
directory, preflight with this API, then persist atomically under a validated ID.
`./themes/` is the repository's source directory, not a writable install location
inside a packaged app. Validate before registration/publication, preserve the old
active theme on failure, protect built-in IDs, and fall back to the same kind on
uninstall. Load installed definitions before resolving selected IDs, and use a
validated startup snapshot to preserve the no-flash first frame. Native I/O must
use the existing platform service boundary; theme packages receive no
capabilities or executable entry point. Add export/import/update and cross-window
invalidation there, not in components or arbitrary CSS loading.

## References and verification

The [Catppuccin palette](https://catppuccin.com/palette/) is the starting point;
Stage0's variants retain historical overrides. [Design Tokens 2025.10](https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/)
informs the separation of palette and semantic roles; this small v1 package format
is **not** a claim of full DTCG format conformance.

Tests compare all historical palette/splash variables, exercise a synthetic theme
without new CSS, verify syntax roles/light editable surfaces/nested diff scopes,
validate hostile package rejection and retain startup/Preferences transactions.
