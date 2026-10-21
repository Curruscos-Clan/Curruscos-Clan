import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]

CHAT_HTML = (ROOT / "chat.html").read_text(encoding="utf-8")
DECISIONES_HTML = (ROOT / "decisiones.html").read_text(encoding="utf-8")
GUARDADOS_HTML = (ROOT / "guardados.html").read_text(encoding="utf-8")
EXPLORAR_HTML = (ROOT / "explorar.html").read_text(encoding="utf-8")

CHAT_JS = (ROOT / "js" / "chat.js").read_text(encoding="utf-8")
DECISIONES_JS = (ROOT / "js" / "decisiones.js").read_text(encoding="utf-8")
GUARDADOS_JS = (ROOT / "js" / "guardados.js").read_text(encoding="utf-8")
EXPLORAR_JS = (ROOT / "js" / "explorar.js").read_text(encoding="utf-8")


class SearchInputAccessibilityContractTests(unittest.TestCase):
    def test_search_inputs_have_aria_label_attributes(self):
        pages = [
            ("chat.html", CHAT_HTML, 'id="chatSearch"'),
            ("decisiones.html", DECISIONES_HTML, 'id="pollSearch"'),
            ("guardados.html", GUARDADOS_HTML, 'id="savedSearch"'),
            ("explorar.html", EXPLORAR_HTML, 'id="eventSearch"'),
        ]

        for page_name, html, element_id in pages:
            with self.subTest(page=page_name):
                self.assertIn(element_id, html)
                start = html.index(element_id)
                tag_start = html.rfind("<input", 0, start)
                tag_end = html.index(">", start)
                tag = html[tag_start:tag_end + 1]
                self.assertIn('aria-label=', tag)

    def test_search_inputs_support_escape_key_dismissal_and_focus_restoration(self):
        scripts = [
            ("js/chat.js", CHAT_JS),
            ("js/decisiones.js", DECISIONES_JS),
            ("js/guardados.js", GUARDADOS_JS),
            ("js/explorar.js", EXPLORAR_JS),
        ]

        for script_name, js in scripts:
            with self.subTest(script=script_name):
                self.assertIn('"Escape"', js)
                self.assertIn('.focus()', js)


if __name__ == "__main__":
    unittest.main()
