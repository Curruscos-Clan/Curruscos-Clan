import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
APP = (ROOT / "js" / "app.js").read_text(encoding="utf-8")


class AccountMenuLoadingTests(unittest.TestCase):
    def test_profile_request_does_not_block_private_shell_initialization(self):
        start = APP.index("function initAccountMenu()")
        end = APP.index("/* ========================================================", start)
        menu = APP[start:end]
        self.assertNotIn("await getCurrentProfile()", menu)
        self.assertIn("Promise.resolve()", menu)
        self.assertIn(".then(() => getCurrentProfile())", menu)

    def test_account_menu_handlers_are_wired_before_profile_request(self):
        start = APP.index("function initAccountMenu()")
        end = APP.index("/* ========================================================", start)
        menu = APP[start:end]
        self.assertLess(menu.index('button.addEventListener("click"'), menu.index("Promise.resolve()"))
        self.assertLess(menu.index('logout?.addEventListener("click"'), menu.index("Promise.resolve()"))

    def test_profile_updates_refresh_the_account_menu(self):
        self.assertIn('window.addEventListener("curruscos:profile-updated"', APP)


if __name__ == "__main__":
    unittest.main()
