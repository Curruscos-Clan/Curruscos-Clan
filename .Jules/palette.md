## 2026-10-21 - Search Input Accessibility & Keyboard Dismissal
**Learning:** Search inputs on list and filter pages frequently lack explicit `aria-label` attributes and keyboard `Escape` dismissal handlers, forcing screen reader users to rely on placeholders and keyboard users to manually erase queries.
**Action:** Always provide explicit `aria-label` attributes for `<input type="search">` elements and bind an `Escape` keydown listener that clears the search query, updates results, and calls `.focus()` on the input element.
