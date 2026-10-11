import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]


class NavigationAccessibilityTests(unittest.TestCase):
    def test_menu_button_is_guarded_when_primary_nav_is_missing(self):
        source = (ROOT / "js" / "navigation.js").read_text(encoding="utf-8")
        self.assertIn("if(button && nav && button.dataset.navReady!==\"true\")", source)

    def test_mobile_menu_supports_aria_state_and_escape_key(self):
        source = (ROOT / "js" / "navigation.js").read_text(encoding="utf-8")
        for expected in (
            'button.setAttribute("aria-controls","mainNav")',
            'button.setAttribute("aria-expanded",String(open))',
            'button.setAttribute("aria-label",open?"Cerrar menú":"Abrir menú")',
            'if(e.key==="Escape"',
            "button.focus()",
        ):
            with self.subTest(expected=expected):
                self.assertIn(expected, source)

    def test_mobile_menu_css_does_not_hide_the_four_tab_bottom_navigation(self):
        css = (ROOT / "css" / "style.css").read_text(encoding="utf-8")
        self.assertIn("nav.mobile-open", css)
        self.assertIn(".navbar #mainNav.mobile-open", css)
        import re
        self.assertNotRegex(css, r"\.bottom-nav\s*\{\s*display\s*:\s*none\s*!important")

    def test_create_hub_does_not_claim_a_primary_tab(self):
        source = (ROOT / "js" / "navigation.js").read_text(encoding="utf-8")
        self.assertNotIn('"crear.html"]', source)
        self.assertIn('"crear-evento.html"]', source)


if __name__ == "__main__":
    unittest.main()
