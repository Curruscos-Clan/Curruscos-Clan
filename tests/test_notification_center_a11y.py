import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
APP = (ROOT / "js" / "app.js").read_text(encoding="utf-8")


class NotificationCenterA11yTests(unittest.TestCase):
    def test_notification_button_has_aria_attributes(self):
        self.assertIn('aria-expanded="false"', APP)
        self.assertIn('aria-controls="notificationPanel"', APP)

    def test_notification_center_supports_aria_expanded_toggle(self):
        start = APP.index("async function initNotificationCenter()")
        end = APP.index("/* ========================================================", start)
        fn = APP[start:end]

        self.assertIn('refs.button.setAttribute("aria-expanded", "false");', fn)
        self.assertIn('refs.button.setAttribute("aria-controls", "notificationPanel");', fn)
        self.assertIn('refs.button.setAttribute(\n                "aria-expanded",\n                String(!refs.panel.hidden)\n            );', fn)

    def test_notification_center_supports_keyboard_escape_dismissal(self):
        start = APP.index("async function initNotificationCenter()")
        end = APP.index("/* ========================================================", start)
        fn = APP[start:end]

        for expected in (
            'event.key === "Escape"',
            'refs.button.setAttribute("aria-expanded", "false");',
            "refs.button.focus()",
        ):
            with self.subTest(expected=expected):
                self.assertIn(expected, fn)


if __name__ == "__main__":
    unittest.main()
