import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = (ROOT / "js" / "supabase.js").read_text(encoding="utf-8")


class ProfileCacheRegressionTests(unittest.TestCase):
    def test_forced_profile_refresh_also_refreshes_the_user(self):
        start = SOURCE.index("async function getCurrentProfile(forceRefresh = false)")
        end = SOURCE.index("// ========================================", start)
        function = SOURCE[start:end]
        self.assertIn("getCurrentUser(forceRefresh)", function)

    def test_profile_cache_is_scoped_to_the_current_user(self):
        start = SOURCE.index("async function getCurrentProfile(forceRefresh = false)")
        end = SOURCE.index("// ========================================", start)
        function = SOURCE[start:end]
        self.assertIn("currentProfileUserId === user.id", function)
        self.assertIn("currentProfileUserId = user.id", function)
        self.assertIn("currentProfileUserId = null", function)

    def test_sign_out_clears_profile_cache_identity(self):
        start = SOURCE.index("async function signOut()")
        end = SOURCE.index("// ========================================", start)
        function = SOURCE[start:end]
        self.assertIn("currentProfileUserId = null", function)


if __name__ == "__main__":
    unittest.main()
