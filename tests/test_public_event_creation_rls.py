from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "supabase/migrations/20261101203344_allow_standalone_public_event_creation.sql"
CREATE_JS = ROOT / "js/supabase.js"


class PublicEventCreationRlsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sql = MIGRATION.read_text(encoding="utf-8").lower()
        cls.js = CREATE_JS.read_text(encoding="utf-8")

    def test_authenticated_users_can_create_only_their_own_standalone_public_events(self):
        self.assertIn("for insert", self.sql)
        self.assertIn("to authenticated", self.sql)
        self.assertIn("(select auth.uid()) is not null", self.sql)
        self.assertIn("created_by = (select auth.uid())", self.sql)
        self.assertIn("group_id is null", self.sql)
        self.assertIn("trip_id is null", self.sql)
        self.assertIn("visibility = 'public'", self.sql)
        self.assertIn("status = 'published'", self.sql)

    def test_public_event_policy_keeps_workspace_and_encrypted_event_paths_closed(self):
        self.assertIn("encrypted_payload is null", self.sql)
        self.assertIn("encryption_version is null", self.sql)
        self.assertIn("is_hidden is false", self.sql)

    def test_public_event_policy_validates_client_supplied_fields(self):
        self.assertIn("between 1 and 120", self.sql)
        self.assertIn("capacity is null or capacity >= 1", self.sql)
        self.assertIn("entry_fee >= 0", self.sql)
        self.assertIn("team_size between 2 and 50", self.sql)

    def test_frontend_uses_authenticated_public_event_insert_path(self):
        start = self.js.index("async function createPublicEvent(eventData)")
        end = self.js.index("async function getPublicEventParticipants", start)
        helper = self.js[start:end]
        self.assertIn('getCurrentUser(false, { throwOnError: true })', helper)
        self.assertIn('.from("events")', helper)
        self.assertIn('visibility: "public"', helper)
        self.assertIn('status: "published"', helper)


if __name__ == "__main__":
    unittest.main()
