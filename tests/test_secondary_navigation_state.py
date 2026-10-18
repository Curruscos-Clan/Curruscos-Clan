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


def shared_item_pages(href):
    match = re.search(
        r'\{href:"' + re.escape(href) + r'",label:"[^"]+".*?pages:\[([^\]]*)\]',
        NAV_JS[NAV_JS.index("const items="):],
        flags=re.S,
    )
    if not match:
        raise AssertionError(f"Could not find shared navigation item {href}")
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

    def test_secondary_creation_hub_does_not_activate_a_primary_tab(self):
        self.assertNotIn('"crear.html"', primary_navigation_pages(NAV_JS))

    def test_public_event_creation_and_detail_belong_to_buscar(self):
        pages = shared_item_pages("explorar.html")
        self.assertIn('"evento-publico.html"', pages)
        self.assertIn('"crear-evento.html"', pages)
        self.assertNotIn('"crear.html"', pages)

    def test_dashboard_belongs_to_mi_grupo(self):
        pages = shared_item_pages("eventos.html")
        self.assertIn('"eventos.html"', pages)
        self.assertIn('"dashboard.html"', pages)

    def test_secondary_page_mobile_tabs_use_the_four_primary_destinations(self):
        expected = {
            "evento-publico.html": ("Inicio", "Buscar", "Mi grupo", "Mi perfil"),
            "mis-planes.html": ("Inicio", "Buscar", "Mi grupo", "Mi perfil"),
        }
        for filename, labels in expected.items():
            source = (ROOT / filename).read_text(encoding="utf-8")
            start = source.index('<nav class="bottom-nav"')
            end = source.index("</nav>", start)
            nav = source[start:end]
            for href in ("index.html", "explorar.html", "eventos.html", "perfil.html"):
                with self.subTest(page=filename, destination=href):
                    self.assertIn(f'href="{href}"', nav)
            for label in labels:
                with self.subTest(page=filename, label=label):
                    self.assertIn(f"<span>{label}</span>", nav)
            self.assertNotIn('href="crear-evento.html"', nav)
            self.assertNotIn('href="mis-planes.html"', nav)

    def test_app_shell_does_not_register_duplicate_mobile_menu_handler(self):
        start = APP_JS.index("function setupMobileMenu()")
        end = APP_JS.index("/* =========================================================", start + 1)
        setup = APP_JS[start:end]
        self.assertIn('menuButton.dataset.navReady === "true"', setup)
        self.assertIn('menuButton.dataset.ready === "true"', setup)


def primary_navigation_pages(source):
    start = source.index("const items=")
    end = source.index("function init()", start)
    return source[start:end]


if __name__ == "__main__":
    unittest.main()
