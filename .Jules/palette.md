## 2026-10-19 - App Shell Header Dropdown Accessibility Standard
**Learning:** Shell dropdown triggers (Account Menu, Group Switcher, Notification Center) require explicit `aria-expanded` and `aria-controls` attributes, dynamic attribute toggling on panel state changes, and `Escape` key dismissal with focus restoration to maintain accessible keyboard navigation.
**Action:** When adding or updating top-bar menu triggers, ensure `aria-expanded` is updated on all close triggers (outside click, button toggle, Escape key) and focus returns to the trigger button on Escape dismissal.
