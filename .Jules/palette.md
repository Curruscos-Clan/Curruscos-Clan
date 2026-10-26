## 2026-03-30 - Search Field Keyboard & Screen Reader Parity
**Learning:** Icon-less search inputs without visible labels require explicit `aria-label` attributes for screen readers, and benefit significantly from `Escape` key handlers that clear filter text and restore focus.
**Action:** Always verify search inputs in list views have `aria-label` attributes and implement `Escape` dismissal with focus restoration.
