import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = (ROOT / "js" / "i18n.js").read_text(encoding="utf-8")


class I18nNonBlockingInitializationTests(unittest.TestCase):
    def test_ready_has_a_short_safety_timeout(self):
        ready = SOURCE[SOURCE.index("window.curruscosI18n.ready="):]
        self.assertIn("window.setTimeout(finish,1200)", ready)
        self.assertIn("applyI18n(document).then(finish)", ready)

    def test_translation_failure_does_not_prevent_ready_from_resolving(self):
        ready = SOURCE[SOURCE.index("window.curruscosI18n.ready="):]
        self.assertIn(".catch(error=>", ready)
        self.assertIn("finish();", ready)

    def test_late_locale_completion_can_still_apply_translations(self):
        self.assertIn("async function applyI18n(root)", SOURCE)
        self.assertIn("applyAttributeTranslations(root||document)", SOURCE)


if __name__ == "__main__":
    unittest.main()
