import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
HTML = (ROOT / "mis-planes.html").read_text(encoding="utf-8")
JS = (ROOT / "js" / "mis-planes.js").read_text(encoding="utf-8")
SUPABASE = (ROOT / "js" / "supabase.js").read_text(encoding="utf-8")
PAGES = {
    name: (ROOT / name).read_text(encoding="utf-8")
    for name in ("index.html", "explorar.html", "perfil.html")
}


class MyPlansRegressionTests(unittest.TestCase):
    def test_page_has_attending_and_organizing_tabs(self):
        self.assertIn('data-tab="attending"', HTML)
        self.assertIn('data-tab="organizing"', HTML)
        self.assertIn('id="plans-content"', HTML)

    def test_guest_state_links_to_canonical_login(self):
        self.assertIn('getCurrentUser(true)', JS)
        self.assertIn('"Iniciar sesión"', JS)
        self.assertIn('"login.html"', JS)

    def test_attendance_uses_existing_schema_helpers_not_wrong_table(self):
        self.assertIn("getMyPublicEvents()", JS)
        self.assertIn("leavePublicEvent(event.id)", JS)
        self.assertIn("async function getMyPublicEvents()", SUPABASE)
        self.assertIn("async function leavePublicEvent(eventId)", SUPABASE)
        self.assertIn('.from("event_participants")', SUPABASE)
        self.assertNotIn('from("event_attendees")', JS)

    def test_cancellation_requires_confirm_and_checks_result(self):
        self.assertIn("window.confirm(", JS)
        self.assertIn("if (!removed) throw new Error", JS)
        self.assertIn('cancel.textContent = "Cancelar asistencia"', JS)

    def test_user_content_is_rendered_as_text(self):
        self.assertIn("title.textContent = event.title", JS)
        self.assertIn("location.textContent =", JS)

    def test_all_primary_navigation_points_to_mis_plans(self):
        self.assertIn('href="mis-planes.html"', HTML)
        for name, content in PAGES.items():
            with self.subTest(page=name):
                self.assertIn('href="mis-planes.html"', content)

    def test_group_events_remain_reachable_from_plans_page(self):
        self.assertIn('href="eventos.html"', HTML)


if __name__ == "__main__":
    unittest.main()
