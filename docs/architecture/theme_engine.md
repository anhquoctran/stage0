# Theme engine ownership and migration

See [theme packages](../../themes/README.md) for the versioned format, authoring
steps, API and planned installer boundary. This refactor keeps existing preferences
and native IPC unchanged.

| Responsibility | Owner |
| --- | --- |
| Built-in palettes and startup color values | `themes/dark/` and `themes/light/` |
| Theme-group form/search styles and compatibility aliases | `themes/shared/` |
| Allowed color properties and package editor schema | `themes/color-tokens.json`, `themes/theme.schema.json` |
| Strict JSON/color validation and byte limits | `core/themes/validateTheme.ts` |
| Immutable registry, duplicate protection, subscriptions | `core/themes/ThemeRegistry.ts` |
| Built-in registration, legacy aliases, defaults, display names | `core/themes/catalog.ts` |
| Root attributes/classes, color-scheme and owned variable cleanup | `core/themes/applyTheme.ts` |
| Mode storage, OS/preference publications, public legacy facade | `core/store/useThemeStore.ts` |
| Preferences draft, atomic Apply/OK/Cancel | Existing preferences transaction; palette cards stage the same mode as mode controls |
| Diff/highlight presentation | `core/styles/code-viewers.css` |
| Markdown presentation | `core/styles/markdown-preview.css` |

CSS extraction is separate from runtime changes in the commit history. Existing
`mocha` / `mocha-light`, `latte`, `.dark` / `.light` and `--ctp-*` integrations remain
compatibility inputs. App consumers use registry kind and neutral color tokens.
The old `CatppuccinTheme` type is a deprecated compatibility contract; new code uses
`ThemeId` and `ThemeDefinition`. Existing storage keys deliberately remain intact.

Do not combine theme kind and package identity: a new Dark theme must not be
classified as Light because its ID is not `mocha`. Likewise, descendant viewer
attributes must not reset the root's active custom color overrides. Runtime themes
can supply only known color properties. Switching back clears all owned override
properties while preserving viewer fonts, density and native window geometry.

Local source-regression readers follow the extracted CSS imports. Existing
assertions and reference cases remain intact. The protected Theme Engine test keeps
the historical palette snapshot with its assertions, so it cannot drift as a
separate fixture file. Node and real React/browser tests cover package validation,
registry/application behavior, palette parity and editable Light surfaces. Website
styles, OS display scale and native capabilities remain separate.
