from pathlib import Path
import unittest


MIGRATION = Path(__file__).resolve().parents[1] / "migrations" / "20261010130000_require_public_activity_for_public_profile.sql"


class PublicProfilePrivacyMigrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sql = MIGRATION.read_text(encoding="utf-8").lower()

    def test_function_keeps_safe_execution_context(self):
        self.assertIn("security definer", self.sql)
        self.assertIn("set search_path = ''", self.sql)

    def test_profile_is_returned_only_with_public_activity(self):
        sql = self.sql
        guard_start = sql.index("where p.id = target_user_id")
        guard = sql[guard_start:]
        self.assertIn("and (", guard)
        self.assertIn("exists (", guard)
        self.assertIn("e.visibility = 'public'", guard)
        self.assertIn("e.status in ('published', 'preparing', 'live', 'finished')", guard)
        self.assertIn("e.created_by = target_user_id", guard)
        self.assertIn("ep.user_id = target_user_id", guard)
        self.assertIn("ep.status = 'yes'", guard)
        self.assertIn("etm.user_id = target_user_id", guard)

    def test_public_activity_guard_is_not_only_an_aggregate(self):
        # The final profile-row filter must contain the guard, not merely CTEs
        # that calculate zero-valued statistics for users with no public activity.
        final_select = self.sql[self.sql.rfind("select\n  p.id"):]
        self.assertIn("where p.id = target_user_id", final_select)
        self.assertIn("and (", final_select)
        self.assertIn("exists (", final_select)


if __name__ == "__main__":
    unittest.main()
