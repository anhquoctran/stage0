# Configurable UI density

`Preferences → Appearance → Density` offers **Standard**, **Compact**, and
**Touch**. Standard is the default, including for existing installations whose
preferences have no density field. Density adjusts controls and spacing; it does
not change the UI font size, zoom, viewer font, or diff line spacing.

## Interaction and persistence

The density cards are a keyboard-accessible radio group with a small sample of
each mode. Choosing a card changes only the Preferences draft. Apply/OK commits
`appearance.density` with the other preferences in the existing atomic native
transaction. A failed commit retains the draft and does not change the document
attribute. Cancel discards the draft; Reset stages Standard. No restart is needed.

The JSON schema accepts `standard`, `compact`, and `touch`. Missing values remain
valid for older documents; explicit unsupported values are rejected by Rust.
Frontend bootstrap defensively normalizes unknown values to Standard.

A changed density is checked against both the runtime baseline and the latest
preferences document before committing. A conflicting edit from another window
requires reopening Preferences. If density is untouched, another window's value
is retained. Existing publication sequencing and compare-and-swap validation
remain authoritative. Each window applies committed publications through
`stage0-preferences-updated`; a newly opened window reads persisted bootstrap.

## Sizing and ownership

`preferences/utils/uiDensity.ts` owns supported values, normalization and the Git
graph row height. `applyUiDensityToDocument.ts` sets `data-ui-density` on the
window's document root. `core/styles/ui-density.css` owns semantic spacing tokens
and document selectors, including portalled menus. Shared controls do not import
the preferences store.

| Surface | Standard | Compact | Touch |
| --- | --- | --- | --- |
| Control minimum height | Existing sizes | 24 px | 44 px |
| File/menu row vertical padding | Existing sizes | 3 px (file rows) | 12 px (file rows) |
| Preferences row vertical padding | 12 px | 8 px | 16 px |
| Git action toolbar | 64 px | 56 px | 80 px |
| Workspace tab bar | 40 px | 32 px | 56 px |
| Git graph row | 36 px | 28 px | 48 px |

Standard introduces **no size overrides**. Compact and Touch adjust buttons,
text inputs, selects, menu options, file rows, preferences rows and marked layout
bars. Text remains at its configured size and can make a row taller when needed.
Checkbox/radio visuals keep native sizes; switches keep their track size and gain
a 44 px hit area in Touch. Scroll containers retain scrolling instead of growing
past their window. Cards wrap to one column in narrow preference panels.

`data-density-exempt` preserves system title bars/traffic lights and the diff
content area, whose line geometry belongs to editor preferences. Diff toolbar and
encoding controls outside that area still respond to density. Git graph SVG
height, node centers and edge curves are recalculated together; never change only
the table row height with CSS. Density is independent of theme and RTL direction.
Touch improves application control target sizes; it is not a claim that every
embedded editor or system control satisfies a touch accessibility standard.

## Design references and verification

[Carbon's table specifications](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/specifications)
use explicit row sizes rather than changing typography. The Touch minimum follows
[WCAG's enhanced 44 CSS pixel target guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html).
Native title bars and code editors remain separate sizing systems.

`ui-density.test.mjs` protects draft, Apply/Cancel/OK/Reset, failures, defaults and
concurrent edits. Real React tests cover radio keyboard navigation, committed
publication and reactive Git graph geometry. Chromium tests load the production
stylesheet at a 375 px viewport and check control/row sizes, portal bounds,
Standard restoration and native/editor exemptions. Rust tests validate persisted
values and backward compatibility. These tests run through the existing protected
regression CI, including native jobs on Linux, Windows and macOS.
