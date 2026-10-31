import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
HTML = (ROOT / "guardados.html").read_text(encoding="utf-8")
JS = (ROOT / "js" / "guardados.js").read_text(encoding="utf-8")


class SavedSearchAccessibilityTests(unittest.TestCase):
    def test_saved_search_has_explicit_aria_label(self):
        self.assertIn('id="savedSearch"', HTML)
        self.assertIn('aria-label="Buscar en tus guardados"', HTML)

    def test_saved_search_handles_escape_key(self):
        self.assertIn('event.key === "Escape"', JS)
        self.assertIn('searchInput.value = ""', JS)
        self.assertIn('searchInput.focus()', JS)


if __name__ == "__main__":
    unittest.main()
