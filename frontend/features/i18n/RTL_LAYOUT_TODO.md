# RTL layout follow-up

The app applies `dir="rtl"` from the persisted application locale. This pass replaced
physical Tailwind spacing, inset, border, and text alignment utilities with logical
utilities in 83 JSX components. Markdown prose lists, quotations, tables, and controls
also use logical CSS properties. Menus align and open submenus toward the available
inline direction, and keyboard traversal follows that direction.

The follow-up code audit keeps native window controls at their platform-defined physical
edges while applying the active direction to the menu itself. Sidebar resizing now measures
from the workspace's inline edge. Previous/next navigation arrows mirror in RTL; file paths,
branch names, hashes, and code excerpts retain LTR direction while surrounding prose follows
the selected locale. The Tailwind audit also replaced unsupported `py-0.2` candidates and
defined the enter/fade/zoom/slide utilities used by the UI.

The remaining physical direction rules are intentional for code-oriented surfaces
and the macOS title bar/traffic lights: diff line numbers, conflict markers, source
excerpts, editor and terminal content, plus the active diff-line marker. Markdown code
blocks and the review code excerpt should stay left-to-right while surrounding prose
follows the selected locale.

Manual visual checks remain for Arabic at narrow and wide sizes, especially nested
popovers, split panes, tabs, discussion threads, and the custom window chrome. Context
menus positioned at the pointer continue to use physical screen coordinates by design.
