import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
LOGIN = (ROOT / "js" / "login.js").read_text(encoding="utf-8")
SUPABASE = (ROOT / "js" / "supabase.js").read_text(encoding="utf-8")


class LoginFlowRegressionTests(unittest.TestCase):
    def test_forced_group_refresh_also_refreshes_auth_user(self):
        start = SUPABASE.index("async function getUserGroups(forceRefresh = false, options = {})")
        end = SUPABASE.index("// ========================================", start)
        function = SUPABASE[start:end]
        self.assertIn("getCurrentUser(forceRefresh)", function)

    def test_post_auth_redirect_handles_group_lookup_failure(self):
        start = LOGIN.index("const redirectAfterAuth = async () =>")
        end = LOGIN.index("const normalizeEmail", start)
        function = LOGIN[start:end]
        self.assertIn("getUserGroups(true, { throwOnError: true })", function)
        self.assertIn("catch (error)", function)
        self.assertIn("no hemos podido cargar tus espacios", function.lower())

    def test_login_page_does_not_treat_group_lookup_failure_as_empty_groups(self):
        start = SUPABASE.index("async function getUserGroups(forceRefresh = false, options = {})")
        end = SUPABASE.index("// ========================================", start)
        function = SUPABASE[start:end]
        self.assertIn("if (options?.throwOnError)", function)


if __name__ == "__main__":
    unittest.main()
