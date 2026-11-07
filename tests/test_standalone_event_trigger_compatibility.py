from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "supabase/migrations/20261107100000_allow_standalone_events_through_triggers.sql"


class StandaloneEventTriggerCompatibilityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sql = MIGRATION.read_text(encoding="utf-8").lower()

    def test_only_own_standalone_public_events_bypass_workspace_quota(self):
        self.assertIn("new.group_id is null", self.sql)
        self.assertIn("tg_table_name = 'events'", self.sql)
        self.assertIn("new.visibility = 'public'", self.sql)
        self.assertIn("new.created_by = v_user", self.sql)
        self.assertIn("v_user is not null", self.sql)
        self.assertIn("raise exception 'group_required'", self.sql)

    def test_group_membership_and_plan_quota_checks_are_preserved(self):
        self.assertIn("not exists (", self.sql)
        self.assertIn("public.group_members", self.sql)
        self.assertIn("not_group_member", self.sql)
        self.assertIn("plan_limit_events", self.sql)
        self.assertIn("plan_limit_trips", self.sql)
        self.assertIn("pg_advisory_xact_lock", self.sql)

    def test_standalone_events_do_not_emit_group_notifications(self):
        self.assertIn("if new.group_id is not null then", self.sql)
        self.assertIn("public.create_group_notifications(", self.sql)
        self.assertIn("return new;", self.sql)


if __name__ == "__main__":
    unittest.main()
