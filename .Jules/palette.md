## 2026-10-28 - Item-specific ARIA labels for action buttons in repeating lists
**Learning:** Generic action buttons (like "Quitar" / "Remove") inside list or grid cards create ambiguous experiences for screen readers when navigated out of context.
**Action:** Always include item context in `aria-label` attributes for repeated list card action buttons (e.g., `aria-label="${esc(t("common.remove"))}: ${esc(item.title)}"`).
