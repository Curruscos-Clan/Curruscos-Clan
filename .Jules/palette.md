# Palette's Journal - Critical UX & Accessibility Learnings

## 2026-10-20 - Search Clear Focus & Keyboard Escape
**Learning:** Icon-only clear buttons (like filter reset or search clear) leave screen reader & keyboard focus lost when hiding themselves after click. Restoring focus to the search input (`search.focus()`) and enabling `Escape` key clearing keeps keyboard flow intact.
**Action:** When clearing form/filter fields programmatically, ensure focus is restored to the primary input element.
