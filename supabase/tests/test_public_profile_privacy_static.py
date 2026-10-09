from pathlib import Path
import unittest


MIGRATION = Path(__file__).resolve().parents[1] / "migrations" / "20261010130000_require_public_activity_for_public_profile.sql"


class PublicProfilePrivacyMigrationTests(unittest.TestCase):
    def test_public_profile_requires_public_activity(self):
        sql = MIGRATION.read_text(encoding="utf-8").lower()
        self.assertIn("security definer", sql)
        self.assertIn("set search_path = ''", sql)
        self.assertIn("where p.id = target_user_id", sql)
        self.assertIn("e.visibility = 'public'", sql)
        self.assertIn("e.status in ('published', 'preparing', 'live', 'finished')", sql)
        self.assertIn("ep.status = 'yes'", sql)
        self.assertIn("etm.user_id = target_user_id", sql)


if __name__ == "__main__":
    unittest.main()
