import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
EXPLORE_HTML = (ROOT / "explorar.html").read_text(encoding="utf-8")
EXPLORE_JS = (ROOT / "js" / "explorar.js").read_text(encoding="utf-8")
CHAT_HTML = (ROOT / "chat.html").read_text(encoding="utf-8")
GUARDADOS_HTML = (ROOT / "guardados.html").read_text(encoding="utf-8")
DECISIONES_HTML = (ROOT / "decisiones.html").read_text(encoding="utf-8")


class SearchUxAccessibilityTests(unittest.TestCase):
    def test_explore_search_accessibility_and_keyboard_focus(self):
        self.assertIn('id="eventSearch"', EXPLORE_HTML)
        self.assertIn('aria-label="Buscar eventos, lugares o personas"', EXPLORE_HTML)
        self.assertIn('search?.focus();', EXPLORE_JS)
        self.assertIn('e.key==="Escape"', EXPLORE_JS)

    def test_chat_search_has_aria_label(self):
        self.assertIn('id="chatSearch"', CHAT_HTML)
        self.assertIn('aria-label="Buscar personas o conversaciones"', CHAT_HTML)

    def test_guardados_search_has_aria_label(self):
        self.assertIn('id="savedSearch"', GUARDADOS_HTML)
        self.assertIn('aria-label="Buscar en tus guardados"', GUARDADOS_HTML)

    def test_decisiones_search_has_aria_label(self):
        self.assertIn('id="pollSearch"', DECISIONES_HTML)
        self.assertIn('aria-label="Buscar una decisión"', DECISIONES_HTML)


if __name__ == "__main__":
    unittest.main()
