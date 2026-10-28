import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
LOGIN = (ROOT / "js" / "login.js").read_text(encoding="utf-8")
SUPABASE = (ROOT / "js" / "supabase.js").read_text(encoding="utf-8")


class LoginFlowRegressionTests(unittest.TestCase):
    def test_forced_group_refresh_also_refreshes_auth_user(self):
        start = SUPABASE.index("async function getUserGroups(forceRefresh = false, options = {})")
        end = SUPABASE.index("// ========================================", start)
        self.assertIn(
            "getCurrentUser(forceRefresh, { throwOnError: options?.throwOnError })",
            SUPABASE[start:end],
        )

    def test_strict_user_lookup_propagates_auth_errors(self):
        start = SUPABASE.index("async function getCurrentUser(forceRefresh = false, options = {})")
        end = SUPABASE.index("// ========================================", start)
        function = SUPABASE[start:end]
        self.assertIn("if (options?.throwOnError)", function)
        self.assertIn("throw error", function)
        self.assertIn("currentUserLoaded = false", function)

    def test_post_auth_redirect_handles_group_lookup_failure(self):
        start = LOGIN.index("const redirectAfterAuth = async () =>")
        end = LOGIN.index("const normalizeEmail", start)
        function = LOGIN[start:end]
        self.assertIn("getUserGroups(true, { throwOnError: true })", function)
        self.assertIn("catch (error)", function)
        self.assertIn("no hemos podido cargar tus espacios", function.lower())

    def test_group_lookup_can_distinguish_error_from_no_groups(self):
        start = SUPABASE.index("async function getUserGroups(forceRefresh = false, options = {})")
        end = SUPABASE.index("// ========================================", start)
        self.assertIn("if (options?.throwOnError)", SUPABASE[start:end])

    def test_group_cache_is_checked_only_after_resolving_current_user(self):
        start = SUPABASE.index("async function getUserGroups(forceRefresh = false, options = {})")
        end = SUPABASE.index("async function getCurrentGroup", start)
        function = SUPABASE[start:end]
        self.assertLess(function.index("getCurrentUser(forceRefresh"), function.index("userGroupsCache &&"))
        self.assertIn("userGroupsCacheUserId === user.id", function)
        self.assertIn("userGroupsCacheUserId = user.id", function)

    def test_current_group_cache_is_scoped_to_current_user(self):
        start = SUPABASE.index("async function getCurrentGroup(forceRefresh = false)")
        end = SUPABASE.index("function setCurrentGroup", start)
        function = SUPABASE[start:end]
        self.assertLess(function.index("getCurrentUser(forceRefresh)"), function.index("currentGroupCache &&"))
        self.assertIn("currentGroupCacheUserId === user.id", function)
        self.assertIn("currentGroupCacheUserId = user.id", function)


if __name__ == "__main__":
    unittest.main()
