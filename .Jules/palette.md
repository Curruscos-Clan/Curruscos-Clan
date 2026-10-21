# Palette's Journal - UX & Accessibility Learnings

## 2025-02-18 - Shell Navigation Dropdowns Accessibility Invariants
**Learning:** Shell popover overlays (like account menu, workspace group switcher, and notification center) need consistent `aria-expanded`, `aria-controls`, and keyboard `Escape` dismissal handlers with focus restoration (`button.focus()`) so screen readers and keyboard users can seamlessly open, navigate, and dismiss dropdowns without losing focus context.
**Action:** Whenever creating or updating interactive popover panels or dropdown menus in the app shell, ensure `aria-expanded` is toggled on open/close state changes and register an `Escape` key handler that closes the panel and restores focus to the trigger element.
