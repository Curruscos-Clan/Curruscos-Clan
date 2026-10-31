import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = (ROOT / "js" / "crear-evento.js").read_text(encoding="utf-8")


class CreateEventInitializationTests(unittest.TestCase):
    def test_submit_handler_is_registered_before_session_lookup_is_awaited(self):
        listener = SOURCE.index('form.addEventListener("submit"')
        lookup = SOURCE.index("user = await sessionPromise")
        self.assertLess(listener, lookup)

    def test_auth_lookup_has_a_timeout(self):
        self.assertIn("Promise.race([", SOURCE)
        self.assertIn("10000", SOURCE)

    def test_form_fields_and_public_event_payload_are_preserved(self):
        for field in (
            "publicEventTitle", "publicEventDate", "publicEventTime",
            "publicEventLocation", "publicEventDescription",
            "publicEventCategory", "publicEventType", "publicEventFormat",
            "publicEventScoring", "publicEventRules", "publicEventOrganizer",
            "publicEventCapacity", "publicEventFee", "publicEventDeadline",
            "publicEventParticipantMode", "publicEventTeamSize", "publicEventCover",
        ):
            with self.subTest(field=field):
                self.assertIn(field, SOURCE)
        self.assertIn("createPublicEvent({", SOURCE)
        self.assertIn("window.location.replace", SOURCE)


if __name__ == "__main__":
    unittest.main()
