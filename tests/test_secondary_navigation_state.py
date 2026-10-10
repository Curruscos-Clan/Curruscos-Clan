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
        r"\{\s*href:\s*['\"]perfil\.html['\"].*?pages:\s*\[([^\]]*)\]",
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

    def test_app_shell_keeps_the_four_primary_tabs(self):
        start = APP_JS.index("function ensureProductNavigation()")
        end = APP_JS.index("const links = [", start)
        primary = APP_JS[start:end]
        for href, label in [
            ("index.html", "Inicio"),
            ("explorar.html", "Buscar"),
            ("eventos.html", "Mi grupo"),
            ("perfil.html", "Mi perfil"),
        ]:
            self.assertIn(f'href: "{href}"', primary)
            self.assertIn(f'text: "{label}"', primary)
        self.assertNotIn('href: "mis-eventos.html"', primary)

    def test_shared_navigation_keeps_the_four_primary_tabs(self):
        start = NAV_JS.index("const items=")
        end = NAV_JS.index("function init()", start)
        primary = NAV_JS[start:end]
        for href, label in [
            ("index.html", "Inicio"),
            ("explorar.html", "Buscar"),
            ("eventos.html", "Mi grupo"),
            ("perfil.html", "Mi perfil"),
        ]:
            self.assertIn(f'href:"{href}"', primary)
            self.assertIn(f'label:"{label}"', primary)
        self.assertNotIn('href:"mis-eventos.html"', primary)


if __name__ == "__main__":
    unittest.main()
