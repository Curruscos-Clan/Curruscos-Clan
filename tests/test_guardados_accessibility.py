import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
GUARDADOS_HTML = (ROOT / "guardados.html").read_text(encoding="utf-8")
GUARDADOS_JS = (ROOT / "js" / "guardados.js").read_text(encoding="utf-8")

class GuardadosAccessibilityTests(unittest.TestCase):
    def test_search_input_has_aria_label(self):
        self.assertIn('id="savedSearch"', GUARDADOS_HTML)
        self.assertIn('aria-label="Buscar en tus guardados"', GUARDADOS_HTML)

    def test_search_input_supports_escape_key(self):
        self.assertIn('event.key === "Escape"', GUARDADOS_JS)
        self.assertIn('searchInput.value = ""', GUARDADOS_JS)
        self.assertIn('searchInput.focus()', GUARDADOS_JS)

    def test_saved_remove_buttons_have_descriptive_aria_label(self):
        self.assertIn('class="saved-remove"', GUARDADOS_JS)
        self.assertIn('aria-label="${t("common.remove")} ${esc(event.title)}"', GUARDADOS_JS)

if __name__ == "__main__":
    unittest.main()
