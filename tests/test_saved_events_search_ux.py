import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
GUARDADOS_HTML = (ROOT / "guardados.html").read_text(encoding="utf-8")
GUARDADOS_JS = (ROOT / "js" / "guardados.js").read_text(encoding="utf-8")


class SavedEventsSearchUxTests(unittest.TestCase):
    def test_saved_search_input_has_explicit_aria_label(self):
        self.assertIn('id="savedSearch"', GUARDADOS_HTML)
        self.assertIn('aria-label="Buscar en tus guardados"', GUARDADOS_HTML)

    def test_saved_search_input_handles_escape_key(self):
        self.assertIn('event.key === "Escape"', GUARDADOS_JS)
        self.assertIn('savedSearchInput.value = ""', GUARDADOS_JS)
        self.assertIn('savedSearch = ""', GUARDADOS_JS)
        self.assertIn('savedSearchInput.focus()', GUARDADOS_JS)


if __name__ == "__main__":
    unittest.main()
