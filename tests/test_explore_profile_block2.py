import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
EXPLORE_HTML = (ROOT / "explorar.html").read_text(encoding="utf-8")
EXPLORE_JS = (ROOT / "js" / "explorar.js").read_text(encoding="utf-8")
PROFILE_HTML = (ROOT / "perfil.html").read_text(encoding="utf-8")
PROFILE_JS = (ROOT / "js" / "perfil.js").read_text(encoding="utf-8")
APP_JS = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
LOGIN_JS = (ROOT / "js" / "login.js").read_text(encoding="utf-8")


class ExploreProfileBlock2Tests(unittest.TestCase):
    def test_explore_has_event_and_community_scopes(self):
        self.assertIn('data-scope="events"', EXPLORE_HTML)
        self.assertIn('data-scope="groups"', EXPLORE_HTML)
        self.assertIn('id="groupsSection"', EXPLORE_HTML)
        self.assertIn('id="publicGroupsGrid"', EXPLORE_HTML)

    def test_community_search_uses_public_groups_only(self):
        self.assertIn('from("groups")', EXPLORE_JS)
        self.assertIn('.eq("visibility","public")', EXPLORE_JS)
        self.assertIn("function loadPublicGroups()", EXPLORE_JS)
        self.assertIn('currentExploreScope==="groups"', EXPLORE_JS)

    def test_existing_event_discovery_is_preserved(self):
        self.assertIn('id="publicEventsGrid"', EXPLORE_HTML)
        self.assertIn("async function loadPublicEvents()", EXPLORE_JS)
        self.assertIn("getRecommendedPublicEvents", EXPLORE_JS)
        self.assertIn("getPublicActivePeople", EXPLORE_JS)

    def test_profile_guest_login_and_existing_profile_editor_coexist(self):
        self.assertIn('id="profileAuthView"', PROFILE_HTML)
        self.assertIn('id="profileAuthForm"', PROFILE_HTML)
        self.assertIn('id="profileAuthenticatedView"', PROFILE_HTML)
        self.assertIn('id="profileForm"', PROFILE_HTML)
        self.assertIn('id="interestGrid"', PROFILE_HTML)
        self.assertIn("signInWithPassword", PROFILE_JS)
        self.assertIn("getCurrentProfile(true)", PROFILE_JS)
        self.assertIn("profileLogoutButton", PROFILE_JS)
        self.assertIn('id="profileLogoutButton"', PROFILE_HTML)
        self.assertIn('type="button" class="button button-secondary profile-logout-button">Cerrar sesión</button>', PROFILE_HTML)

    def test_profile_is_not_redirected_away_before_guest_view_renders(self):
        private_pages = APP_JS.split("const PRIVATE_PAGES = new Set([", 1)[1].split("]);", 1)[0]
        self.assertNotIn('"perfil.html"', private_pages)

    def test_existing_registration_flow_can_open_in_register_mode(self):
        self.assertIn('get("mode") === "register"', LOGIN_JS)
        self.assertIn('href="login.html?mode=register"', PROFILE_HTML)


if __name__ == "__main__":
    unittest.main()
