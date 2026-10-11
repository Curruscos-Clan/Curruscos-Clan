import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]


class GroupsLoadErrorRegressionTests(unittest.TestCase):
    def test_group_loader_supports_opt_in_error_propagation(self):
        source = (ROOT / "js" / "supabase.js").read_text(encoding="utf-8")
        self.assertIn("async function getUserGroups(forceRefresh = false, options = {})", source)
        strict_check = source.index("if (options?.throwOnError)")
        cache_fallback = source.index("userGroupsCache = [];", strict_check)
        self.assertLess(strict_check, cache_fallback)

    def test_groups_page_uses_strict_mode_and_has_retry_action(self):
        source = (ROOT / "grupos.html").read_text(encoding="utf-8")
        self.assertIn("getUserGroups(true,{throwOnError:true})", source)
        self.assertIn("function escapeHtml(value)", source)
        self.assertIn("char=>({\"&\":\"&amp;\"", source)
        self.assertIn('role="alert"', source)
        self.assertIn("Tus grupos no se han eliminado", source)
        self.assertIn('id="retryGroupsButton"', source)
        self.assertIn("addEventListener(\"click\",loadGroups", source)

    def test_empty_state_is_only_used_after_successful_load(self):
        source = (ROOT / "grupos.html").read_text(encoding="utf-8")
        empty_state = source.index("Aún no tienes ningún grupo.")
        error_state = source.index("No hemos podido cargar tus grupos.")
        self.assertLess(empty_state, error_state)
        self.assertIn("const groups=await getUserGroups(true,{throwOnError:true});", source)


if __name__ == "__main__":
    unittest.main()
