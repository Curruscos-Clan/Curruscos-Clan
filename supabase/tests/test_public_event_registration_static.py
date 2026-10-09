#!/usr/bin/env python3
"""Static regression checks for the public-event lifecycle migration.

These checks are deliberately not a substitute for executing the SQL against
PostgreSQL. They protect critical invariants until a disposable Supabase DB is
available for integration tests.
"""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "supabase/migrations/20261009190000_harden_public_event_registration_lifecycle.sql"
ANON_POLICY_MIGRATION = ROOT / "supabase/migrations/20261009200000_allow_anon_public_participant_counts.sql"
AUTHORIZATION_MIGRATION = ROOT / "supabase/migrations/20261010100000_null_safe_event_organizer_authorization.sql"
ADDITIONAL_AUTHORIZATION_MIGRATION = ROOT / "supabase/migrations/20261010110000_null_safe_team_match_and_trip_authorization.sql"
JS = ROOT / "js/evento-publico.js"


class PublicEventLifecycleStaticTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sql = MIGRATION.read_text(encoding="utf-8").lower()
        cls.anon_policy_sql = ANON_POLICY_MIGRATION.read_text(encoding="utf-8").lower()
        cls.authorization_sql = AUTHORIZATION_MIGRATION.read_text(encoding="utf-8").lower()
        cls.additional_authorization_sql = ADDITIONAL_AUTHORIZATION_MIGRATION.read_text(encoding="utf-8").lower()
        cls.js = JS.read_text(encoding="utf-8")

    def test_join_rpc_rejects_started_events(self):
        self.assertIn("event_starts_at <= now()", self.sql)
        self.assertIn("'event_started'", self.sql)

    def test_join_rpc_checks_deadline_and_capacity(self):
        self.assertIn("e.registration_deadline <= now()", self.sql)
        self.assertIn("'registration_closed'", self.sql)
        self.assertIn("confirmed_count >= e.capacity", self.sql)
        self.assertIn("'event_full'", self.sql)

    def test_join_rpc_requires_auth_and_published_state(self):
        self.assertIn("auth.uid()", self.sql)
        self.assertIn("e.status <> 'published'", self.sql)
        self.assertIn("'not_authenticated'", self.sql)
        self.assertIn("'event_closed'", self.sql)

    def test_status_transitions_are_forward_only(self):
        required = [
            "(e.status = 'draft' and new_status in ('published','cancelled'))",
            "(e.status = 'published' and new_status in ('preparing','live','finished','cancelled'))",
            "(e.status = 'preparing' and new_status in ('live','finished','cancelled'))",
            "(e.status = 'live' and new_status in ('finished','cancelled'))",
        ]
        for rule in required:
            with self.subTest(rule=rule):
                self.assertIn(rule, self.sql)
        self.assertIn("no se puede reabrir", self.sql)

    def test_status_rpc_keeps_organizer_and_competition_guards(self):
        self.assertIn("is_public_event_organizer(target_event_id)", self.sql)
        self.assertIn("genera primero el cuadro o calendario", self.sql)
        self.assertIn("no puedes finalizar la competición mientras haya partidos pendientes", self.sql)

    def test_participant_policy_preserves_private_rows_for_owner(self):
        self.assertIn("create policy \"users can view own group or confirmed public participation\"", self.sql)
        self.assertIn("user_id = (select auth.uid())", self.sql)
        self.assertIn("is_public_event_organizer(event_participants.event_id)", self.sql)
        self.assertIn("status = 'yes'", self.sql)
        self.assertIn('to authenticated', self.anon_policy_sql)
        self.assertIn('create policy "anonymous visitors can view confirmed public event participants"', self.anon_policy_sql)
        self.assertIn('for select\nto anon\nusing (', self.anon_policy_sql)
        self.assertIn("e.visibility = 'public'", self.anon_policy_sql)
        self.assertIn("e.status in ('published','preparing','live','finished')", self.anon_policy_sql)
        anon_policy = self.anon_policy_sql.split(
            'create policy "anonymous visitors can view confirmed public event participants"', 1
        )[1]
        self.assertIn("status = 'yes'", anon_policy)
        self.assertNotIn("is_public_event_organizer", anon_policy)

    def test_rpc_grants_do_not_allow_anon_execution(self):
        self.assertIn("revoke all on function public.join_public_event(uuid) from public, anon", self.sql)
        self.assertIn("grant execute on function public.join_public_event(uuid) to authenticated", self.sql)
        self.assertIn("revoke all on function public.set_public_event_status(uuid, text) from public, anon", self.sql)

    def test_competition_rpcs_reject_unauthenticated_null_creator_case(self):
        sql = self.authorization_sql
        self.assertGreaterEqual(sql.count("e.created_by is distinct from actor"), 4)
        self.assertGreaterEqual(sql.count("if actor is null then raise exception 'necesitas iniciar sesión'; end if;"), 2)
        for function_name in (
            "generate_knockout_bracket",
            "generate_round_robin_schedule",
            "generate_swiss_round",
            "create_event_team",
        ):
            with self.subTest(function_name=function_name):
                self.assertIn("create or replace function public." + function_name, sql)
        self.assertIn("security definer", sql)
        self.assertIn("set search_path to ''", sql)

    def test_additional_security_definer_rpcs_use_null_safe_authorization(self):
        sql = self.additional_authorization_sql
        self.assertGreaterEqual(sql.count("created_by is distinct from actor"), 3)
        self.assertGreaterEqual(sql.count("created_by is distinct from uid"), 1)
        for function_name in (
            "add_event_team_member",
            "record_event_match_result",
            "remove_event_team_member",
            "create_trip_for_event",
        ):
            with self.subTest(function_name=function_name):
                self.assertIn("create or replace function public." + function_name, sql)
        self.assertGreaterEqual(sql.count("security definer"), 4)
        self.assertGreaterEqual(sql.count("set search_path to ''"), 4)

    def test_frontend_does_not_use_browser_clock_to_decide_event_start(self):
        self.assertNotIn("const eventStarted=new Date(event.date", self.js)
        self.assertIn("event.status!==\"published\"||deadlinePassed", self.js)

    def test_terminal_states_have_no_forward_controls(self):
        start = self.js.index("function renderOrganizerLifecycle")
        end = self.js.index("async function trackEventView", start)
        renderer = self.js[start:end]
        self.assertIn('finished:[]', renderer)
        self.assertIn('cancelled:[]', renderer)
        self.assertIn("Estado definitivo", renderer)


if __name__ == "__main__":
    unittest.main(verbosity=2)
