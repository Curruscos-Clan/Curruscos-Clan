## 2025-02-17 - Search Input Accessibility Invariants
**Learning:** Across search and list pages (`chat.html`, `decisiones.html`, `guardados.html`, `eventos.html`, `explorar.html`), search inputs must have explicit `aria-label` attributes for screen reader clarity, support keyboard `Escape` dismissal to reset search filters, and restore focus to input elements when clearing filters programmatically.
**Action:** Always include `aria-label`, `keydown` Escape handler, and focus restoration when adding or updating search and filter inputs on list pages.
