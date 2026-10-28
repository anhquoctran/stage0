# RTL layout follow-up

The first RTL pass uses logical start/end spacing and alignment in shared controls
and the core application chrome. Keep code, diff, filesystem paths, and identifiers
left-to-right even when the surrounding UI is Arabic.

Remaining work before claiming complete RTL layout coverage:

- Make `core/components/layout/menu-bar/menuPopupPosition.ts` choose the submenu
  opening direction from `document.dir`; it currently computes physical `left`
  coordinates from DOM rectangles.
- Audit feature-owned panels and dialogs for physical `left`/`right`, `ml-*`,
  `mr-*`, `pl-*`, `pr-*`, `text-left`, and `text-right` utilities. Prioritize
  preferences, AI, Git, notifications, and Virtual MR discussion surfaces.
- Keep code-oriented surfaces (diffs, source excerpts, terminal output, paths,
  commit identifiers, and Markdown code blocks) explicitly LTR. Review prose and
  form labels should follow the document direction.
- Verify the window title bar, tab overflow, nested popovers, and split panes in
  an Arabic locale at narrow and wide window sizes.
