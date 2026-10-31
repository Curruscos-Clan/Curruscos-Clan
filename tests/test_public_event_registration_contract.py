from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
JOIN_MIGRATION = ROOT / "supabase/migrations/20261009150305_fix_public_event_join_new_participant.sql"
INSERT_POLICY_MIGRATION = ROOT / "supabase/migrations/20261009150507_restrict_direct_event_participant_inserts.sql"
PUBLIC_EVENT_JS = ROOT / "js/evento-publico.js"
SUPABASE_JS = ROOT / "js/supabase.js"


class PublicEventRegistrationContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.join_sql = JOIN_MIGRATION.read_text(encoding="utf-8").lower()
        cls.policy_sql = INSERT_POLICY_MIGRATION.read_text(encoding="utf-8").lower()
        cls.public_js = PUBLIC_EVENT_JS.read_text(encoding="utf-8")
        cls.supabase_js = SUPABASE_JS.read_text(encoding="utf-8")

    def test_registration_serializes_capacity_checks_per_event(self):
        self.assertRegex(
            self.join_sql,
            r"from\s+public\.events\s+where\s+id\s*=\s*target_event_id\s+for\s+update",
        )
        self.assertIn("select count(*)::integer", self.join_sql)
        self.assertRegex(
            self.join_sql,
            r"e\.capacity\s+is\s+not\s+null\s+and\s+confirmed_count\s*>=\s*e\.capacity",
        )

    def test_new_registration_does_not_depend_on_stale_plpgsql_found_flag(self):
        count_check = self.join_sql.index("select count(*)::integer")
        registration_branch = self.join_sql[count_check:]
        self.assertIn("if existing.id is not null then", registration_branch)
        self.assertIn("insert into public.event_participants(event_id, user_id, status)", registration_branch)
        self.assertNotRegex(registration_branch, r"if\s+found\s+then")

    def test_registration_rpc_is_not_bypassed_by_direct_insert_policy(self):
        self.assertIn('drop policy if exists "users can join events"', self.policy_sql)
        self.assertIn("join_public_event", self.policy_sql)
        self.assertIn('rpc("join_public_event"', self.supabase_js)

    def test_ui_only_refreshes_after_rpc_confirms_success(self):
        marker = "const joined=await joinPublicEvent(id);"
        self.assertIn(marker, self.public_js)
        start = self.public_js.index(marker)
        end = self.public_js.index('await renderPublicEvent();', start)
        block = self.public_js[start:end]
        self.assertIn("if(!joined?.success)", block)
        self.assertIn("return;", block)
        self.assertIn("joined?.message", block)

    def test_cancel_registration_requires_a_confirmed_delete_result(self):
        self.assertIn("const left=await leavePublicEvent(id);", self.public_js)
        self.assertIn("if(left!==true)", self.public_js)
        self.assertIn("No se ha podido cancelar tu inscripción", self.public_js)

    def test_secondary_activity_signal_cannot_reverse_a_confirmed_registration(self):
        self.assertIn("async function recordPublicEventActionSignal(action,event)", self.public_js)
        self.assertIn('recordPublicEventActionSignal("join",event)', self.public_js)
        self.assertIn('recordPublicEventActionSignal("leave",event)', self.public_js)
        helper_start = self.public_js.index("async function recordPublicEventActionSignal")
        helper_end = self.public_js.index("async function renderPublicEvent", helper_start)
        helper = self.public_js[helper_start:helper_end]
        self.assertIn("catch(error)", helper)
        self.assertIn("console.warn", helper)

    def test_leave_registration_propagates_auth_and_database_failures(self):
        start = self.supabase_js.index("async function leavePublicEvent(eventId)")
        end = self.supabase_js.index("async function sendPersistentTeamInvitation", start)
        leave = self.supabase_js[start:end]
        self.assertIn("getCurrentUser(false, { throwOnError: true })", leave)
        self.assertIn("throw new Error(getSupabaseErrorMessage(error", leave)
        self.assertIn("return !!data", leave)


if __name__ == "__main__":
    unittest.main()
