import pathlib
import re
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
APP_JS = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
NAV_JS = (ROOT / "js" / "navigation.js").read_text(encoding="utf-8")


def profile_pages(source, anchor):
    start = source.index(anchor)
    tail = source[start:]
    match = re.search(
        r'\{\s*href:\s*["\\']perfil\\.html["\\'].*?pages:\s*\[([^\]]*)\]',
        tail,
        flags=re.S,
    )
    if not match:
        raise AssertionError("Could not find the Mi perfil navigation item")
    return match.group(1)


class SecondaryNavigationStateTests(unittest.TestCase):
    def test_mis_eventos_is_not_marked_as_mi_perfil_in_app_shell(self):
        pages = profile_pages(APP_JS, "function ensureProductNavigation()")
        self.assertIn('"perfil.html"', pages)
        self.assertNotIn('"mis-eventos.html"', pages)

    def test_mis_eventos_is_not_marked_as_mi_perfil_in_shared_navigation(self):
        pages = profile_pages(NAV_JS, "const items=")
        self.assertIn('"perfil.html"', pages)
        self.assertNotIn('"mis-eventos.html"', pages)


if __name__ == "__main__":
    unittest.main()
