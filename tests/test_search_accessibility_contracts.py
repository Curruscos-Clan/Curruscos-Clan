import pathlib
import re
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]


class SearchAccessibilityContractTests(unittest.TestCase):
    def test_search_inputs_have_aria_labels(self):
        pages_and_inputs = [
            ("chat.html", "chatSearch"),
            ("decisiones.html", "pollSearch"),
            ("guardados.html", "savedSearch"),
            ("explorar.html", "eventSearch"),
        ]
        for filename, input_id in pages_and_inputs:
            html = (ROOT / filename).read_text(encoding="utf-8")
            pattern = r'id="' + re.escape(input_id) + r'"[^>]*aria-label="[^"]+"'
            with self.subTest(file=filename, input=input_id):
                self.assertIsNotNone(
                    re.search(pattern, html),
                    f"Search input #{input_id} in {filename} is missing an explicit aria-label attribute.",
                )

    def test_search_inputs_support_escape_key_dismissal_in_javascript(self):
        js_files = ["js/chat.js", "js/decisiones.js", "js/guardados.js", "js/explorar.js"]
        for js_file in js_files:
            code = (ROOT / js_file).read_text(encoding="utf-8")
            with self.subTest(file=js_file):
                self.assertIn(
                    'Escape',
                    code,
                    f"JavaScript file {js_file} does not handle the Escape key for clearing search inputs.",
                )
                self.assertIn(
                    'focus()',
                    code,
                    f"JavaScript file {js_file} does not restore focus when clearing search input.",
                )


if __name__ == "__main__":
    unittest.main()
