import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]


class ProfileAndEventPublishingRegressionTests(unittest.TestCase):
    def test_profile_does_not_wait_forever_for_i18n(self):
        source = (ROOT / "js/perfil.js").read_text()
        self.assertIn("Promise.race([", source)
        self.assertIn("setTimeout(resolve, 1200)", source)
        self.assertNotIn("await window.curruscosI18n?.ready;", source)

    def test_profile_query_errors_can_reach_the_ui(self):
        source = (ROOT / "js/supabase.js").read_text()
        self.assertIn("async function getCurrentProfile(forceRefresh = false, options = {})", source)
        self.assertIn("if (options?.throwOnError)", source)

    def test_event_creation_does_not_hide_database_errors(self):
        source = (ROOT / "js/supabase.js").read_text()
        start = source.index("async function createPublicEvent(eventData)")
        end = source.index("async function getPublicEventParticipants", start)
        create_function = source[start:end]
        self.assertIn("throwOnError: true", create_function)
        self.assertIn("throw new Error(getSupabaseErrorMessage(error", create_function)
        self.assertNotIn('return null;', create_function)

    def test_create_form_distinguishes_auth_failure_from_guest(self):
        source = (ROOT / "js/crear-evento.js").read_text()
        self.assertIn("getCurrentUser(true, { throwOnError: true })", source)


if __name__ == "__main__":
    unittest.main()
