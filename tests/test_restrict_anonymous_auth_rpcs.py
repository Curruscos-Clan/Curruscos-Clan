import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "supabase/migrations/20261028220000_restrict_anonymous_auth_rpcs.sql"


class RestrictAnonymousAuthRpcTests(unittest.TestCase):
    def test_revokes_public_and_anon_and_preserves_authenticated_access(self):
        sql = re.sub(r"--[^\n]*", "", MIGRATION.read_text(encoding="utf-8")).lower()
        signatures = [
            "public.create_discoverable_group(text, text, text, text)",
            "public.get_group_membership_requests(uuid)",
            "public.join_event_atomic(uuid, uuid)",
            "public.log_recommendation_impression(uuid, uuid, text)",
            "public.request_group_membership(uuid)",
            "public.review_group_membership_request(uuid, boolean)",
        ]
        for signature in signatures:
            with self.subTest(signature=signature):
                escaped = re.escape(signature)
                self.assertRegex(sql, rf"revoke\s+execute\s+on\s+function\s+{escaped}\s+from\s+public\s*,\s*anon")
                self.assertRegex(sql, rf"grant\s+execute\s+on\s+function\s+{escaped}\s+to\s+authenticated")

    def test_does_not_drop_function_bodies_or_modify_public_read_rpcs(self):
        sql = MIGRATION.read_text(encoding="utf-8").lower()
        self.assertNotIn("drop function", sql)
        self.assertNotIn("create or replace function", sql)
        self.assertNotIn("get_public_profile", sql)
        self.assertNotIn("discover_groups", sql)


if __name__ == "__main__":
    unittest.main()
