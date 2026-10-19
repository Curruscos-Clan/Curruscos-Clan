import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
APP = (ROOT / "js" / "app.js").read_text(encoding="utf-8")


class NotificationCenterA11yTests(unittest.TestCase):
    def test_notification_button_has_accessible_attributes(self):
        self.assertIn(
            'id="notificationButton" class="notification-button" type="button" aria-label="Notificaciones" aria-expanded="false" aria-controls="notificationPanel"',
            APP,
        )

    def test_notification_center_toggles_aria_expanded(self):
        start = APP.index("async function initNotificationCenter()")
        end = APP.index("/* ========================================================", start)
        func = APP[start:end]
        self.assertIn(
            'refs.button.setAttribute(\n                "aria-expanded",\n                String(!refs.panel.hidden)\n            )',
            func,
        )

    def test_notification_center_supports_keyboard_escape_dismissal(self):
        start = APP.index("async function initNotificationCenter()")
        end = APP.index("/* ========================================================", start)
        func = APP[start:end]
        for expected in (
            'event.key === "Escape"',
            "refs.panel.hidden = true",
            'refs.button.setAttribute("aria-expanded", "false")',
            "refs.button.focus()",
        ):
            with self.subTest(expected=expected):
                self.assertIn(expected, func)


if __name__ == "__main__":
    unittest.main()
