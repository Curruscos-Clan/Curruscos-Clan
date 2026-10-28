import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]


class SavedEventsAccessibilityTest(unittest.TestCase):
    def setUp(self):
        self.guardados_js = (ROOT / "js/guardados.js").read_text()

    def test_saved_remove_button_has_aria_label_with_event_title(self):
        self.assertIn('aria-label="${esc(t("common.remove"))}: ${esc(event.title)}"', self.guardados_js)


if __name__ == "__main__":
    unittest.main()
