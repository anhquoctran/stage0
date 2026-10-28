# RTL layout follow-up

The app applies `dir="rtl"` from the persisted application locale. This pass replaced
physical Tailwind spacing, inset, border, and text alignment utilities with logical
utilities in 83 JSX components. Markdown prose lists, quotations, tables, and controls
also use logical CSS properties. Menus align and open submenus toward the available
inline direction, and keyboard traversal follows that direction.

The remaining physical direction rules are intentional for code-oriented surfaces
and the macOS title bar/traffic lights: diff line numbers, conflict markers, source
excerpts, editor and terminal content, plus the active diff-line marker. Markdown code
blocks and the review code excerpt should stay left-to-right while surrounding prose
follows the selected locale.

Manual visual checks remain for Arabic at narrow and wide sizes, especially nested
popovers, split panes, tabs, discussion threads, and the custom window chrome. Context
menus positioned at the pointer continue to use physical screen coordinates by design.
