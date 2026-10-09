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
JS = ROOT / "js/evento-publico.js"


class PublicEventLifecycleStaticTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sql = MIGRATION.read_text(encoding="utf-8").lower()
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

    def test_rpc_grants_do_not_allow_anon_execution(self):
        self.assertIn("revoke all on function public.join_public_event(uuid) from public, anon", self.sql)
        self.assertIn("grant execute on function public.join_public_event(uuid) to authenticated", self.sql)
        self.assertIn("revoke all on function public.set_public_event_status(uuid, text) from public, anon", self.sql)

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
