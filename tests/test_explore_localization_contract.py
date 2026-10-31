import json
import pathlib
import re
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
SUPPORTED_LANGUAGES = ("es", "en", "ar", "de", "fr", "it", "pt", "zh")
EXPLORE_HTML = (ROOT / "explorar.html").read_text(encoding="utf-8")
I18N_KEYS = sorted(set(re.findall(
    r'data-i18n(?:-aria-label|-placeholder)="([^"]+)"',
    EXPLORE_HTML,
)))


def nested_value(source, path):
    value = source
    for part in path.split("."):
        if not isinstance(value, dict) or part not in value:
            return None
        value = value[part]
    return value


class ExploreLocalizationContractTests(unittest.TestCase):
    def test_every_supported_locale_contains_all_explore_markup_keys(self):
        for language in SUPPORTED_LANGUAGES:
            with self.subTest(language=language):
                locale_path = ROOT / "locales" / f"{language}.json"
                locale = json.loads(locale_path.read_text(encoding="utf-8"))
                missing = [
                    key for key in I18N_KEYS
                    if not isinstance(nested_value(locale, key), str)
                    or not nested_value(locale, key).strip()
                ]
                self.assertEqual(
                    missing,
                    [],
                    f"{language}.json is missing valid translations for: {missing}",
                )

    def test_explore_keeps_event_discovery_without_community_scope(self):
        self.assertIn('id="publicEventsGrid"', EXPLORE_HTML)
        self.assertNotIn('data-scope="groups"', EXPLORE_HTML)
        self.assertNotIn('id="groupsSection"', EXPLORE_HTML)


if __name__ == "__main__":
    unittest.main()
