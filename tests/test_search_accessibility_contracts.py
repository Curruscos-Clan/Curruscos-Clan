import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]


class SearchAccessibilityContractsTests(unittest.TestCase):
    def test_search_inputs_have_aria_labels(self):
        pages_and_ids = {
            "chat.html": "chatSearch",
            "decisiones.html": "pollSearch",
            "guardados.html": "savedSearch",
            "eventos.html": "eventsSearch",
            "explorar.html": "eventSearch",
        }

        for page, input_id in pages_and_ids.items():
            source = (ROOT / page).read_text(encoding="utf-8")
            pattern = r'<input[^>]*id=["\']' + re.escape(input_id) + r'["\'][^>]*>'
            match = re.search(pattern, source)
            self.assertIsNotNone(match, f"Input #{input_id} not found in {page}")
            input_tag = match.group(0)
            self.assertIn(
                'aria-label="',
                input_tag,
                f"Input #{input_id} in {page} is missing an explicit aria-label attribute",
            )

    def test_search_js_modules_support_escape_key_dismissal(self):
        js_files_and_targets = {
            "js/chat.js": "chatSearch",
            "js/decisiones.js": "pollSearch",
            "js/guardados.js": "savedSearch",
            "js/explorar.js": "eventSearch",
            "js/app.js": "eventsSearch",
        }

        for js_file, target in js_files_and_targets.items():
            source = (ROOT / js_file).read_text(encoding="utf-8")
            self.assertIn(
                "Escape",
                source,
                f"{js_file} does not contain Escape key handling for {target}",
            )

    def test_explorar_clears_filters_and_restores_search_focus(self):
        source = (ROOT / "js" / "explorar.js").read_text(encoding="utf-8")
        self.assertIn(
            "search.focus()",
            source,
            "js/explorar.js does not restore focus to search input on clearing filters",
        )


if __name__ == "__main__":
    unittest.main()
