import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
PRIMARY_TABS = [
    ("index.html", "Inicio"),
    ("explorar.html", "Buscar"),
    ("eventos.html", "Mi grupo"),
    ("perfil.html", "Mi perfil"),
]
VISUAL_REFRESH_PAGES = [
    "index.html",
    "explorar.html",
    "eventos.html",
    "mis-eventos.html",
    "dashboard.html",
    "crear.html",
    "crear-evento.html",
    "evento-publico.html",
    "perfil.html",
]


class VisualRefreshRegressionTests(unittest.TestCase):
    def test_primary_navigation_keeps_the_four_requested_destinations(self):
        source = (ROOT / "js" / "navigation.js").read_text(encoding="utf-8")
        for href, label in PRIMARY_TABS:
            with self.subTest(href=href, label=label):
                self.assertIn(f'href:"{href}",label:"{label}"', source)

    def test_visual_refresh_pages_have_balanced_style_blocks(self):
        for page in VISUAL_REFRESH_PAGES:
            source = (ROOT / page).read_text(encoding="utf-8")
            opening = len(re.findall(r"<style(?:\\s|>)", source, flags=re.I))
            closing = len(re.findall(r"</style\\s*>", source, flags=re.I))
            with self.subTest(page=page):
                self.assertEqual(
                    opening,
                    closing,
                    f"{page} has {opening} opening and {closing} closing style tags",
                )


if __name__ == "__main__":
    unittest.main()
