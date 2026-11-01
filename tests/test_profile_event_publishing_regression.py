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

    def test_interest_rpc_errors_are_not_treated_as_an_empty_selection(self):
        source = (ROOT / "js/supabase.js").read_text()
        start = source.index("async function getMyInterests()")
        end = source.index("async function setMyInterests(", start)
        helper = source[start:end]
        self.assertIn("if(error)throw new Error", helper)
        self.assertNotIn("if(error){console.error(\"Interests:\",error);return [];}", helper)

    def test_profile_refuses_to_overwrite_interests_when_initial_load_fails(self):
        source = (ROOT / "js/perfil.js").read_text()
        self.assertIn("const interestsLoadFailed = { loadFailed: true }", source)
        self.assertIn("if (loadedInterests === interestsLoadFailed)", source)
        self.assertIn("Recarga la página antes de modificarlos", source)

    def test_profile_activity_queries_propagate_database_errors(self):
        source = (ROOT / "js/supabase.js").read_text()
        start = source.index("async function getMyEventActivity()")
        end = source.index("async function getPublicRankings", start)
        helper = source[start:end]
        for error_name in ("partsError", "organizingError", "membersError"):
            with self.subTest(error=error_name):
                self.assertIn(f"if ({error_name}) throw new Error", helper)
        self.assertIn("if (error) throw new Error", helper)

    def test_profile_does_not_render_activity_query_failure_as_zero_activity(self):
        source = (ROOT / "js/perfil.js").read_text()
        self.assertIn("const activityLoadFailed = { loadFailed: true }", source)
        self.assertIn("if (activity === activityLoadFailed)", source)
        self.assertIn("No se ha podido cargar tu actividad", source)


if __name__ == "__main__":
    unittest.main()
