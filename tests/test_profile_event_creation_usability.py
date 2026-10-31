import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
PROFILE_JS = (ROOT / "js" / "perfil.js").read_text(encoding="utf-8")
CREATE_HTML = (ROOT / "crear-evento.html").read_text(encoding="utf-8")


class ProfileAndEventCreationUsabilityTests(unittest.TestCase):
    def test_profile_controls_are_wired_before_secondary_activity_query(self):
        profile_submit = PROFILE_JS.index('form?.addEventListener("submit"')
        activity_query = PROFILE_JS.index("getMyEventActivity()")
        interest_save = PROFILE_JS.index("interestSave?.addEventListener")
        self.assertLess(interest_save, activity_query)
        self.assertLess(profile_submit, activity_query)

    def test_interest_selection_is_not_overwritten_after_user_interaction(self):
        self.assertIn("let interestsTouched = false", PROFILE_JS)
        self.assertIn("if (interestsTouched) return", PROFILE_JS)

    def test_event_creation_keeps_core_fields_visible_and_advanced_options_collapsed(self):
        self.assertIn('id="publicEventTitle"', CREATE_HTML)
        self.assertIn('id="publicEventCategory"', CREATE_HTML)
        self.assertIn('id="publicEventDate" type="date" required', CREATE_HTML)
        self.assertIn('id="publicEventLocation"', CREATE_HTML)
        self.assertIn('<details class="create-advanced">', CREATE_HTML)
        self.assertIn("Más opciones (formato, plazas, precio y portada)", CREATE_HTML)

    def test_all_existing_event_creation_fields_are_preserved(self):
        for field in (
            "publicEventType", "publicEventFormat", "publicEventScoring",
            "publicEventParticipantMode", "publicEventTeamSize",
            "publicEventCapacity", "publicEventFee", "publicEventDeadline",
            "publicEventOrganizer", "publicEventCover", "publicEventRules",
            "publicEventDescription",
        ):
            with self.subTest(field=field):
                self.assertIn(f'id="{field}"', CREATE_HTML)


if __name__ == "__main__":
    unittest.main()
