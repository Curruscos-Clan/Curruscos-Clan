import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "audit_supabase_migrations.py"
SPEC = importlib.util.spec_from_file_location("migration_audit", SCRIPT)
AUDIT = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(AUDIT)


class MigrationAuditTests(unittest.TestCase):
    def test_detects_duplicate_local_version_without_mutating_files(self):
        local = [
            {"version": "20261004162000", "name": "harden_invitation_mutation", "path": "a.sql"},
            {"version": "20261004162000", "name": "harden_plan_request_rpc_access", "path": "b.sql"},
        ]
        report = AUDIT.compare(local, [])
        self.assertEqual(
            report["duplicate_local_versions"],
            {"20261004162000": ["a.sql", "b.sql"]},
        )

    def test_compares_logical_name_even_if_remote_name_contains_a_timestamp(self):
        local = [
            {"version": "20261003101000", "name": "enrich_group_sense_health", "path": "a.sql"},
        ]
        remote = [
            {"version": "20261003100925", "name": "20261003123000_enrich_group_sense_health"},
        ]
        report = AUDIT.compare(local, remote)
        self.assertEqual(len(report["logical_name_matches"]), 1)
        self.assertEqual(
            report["logical_name_matches"][0]["remote_versions"],
            ["20261003100925"],
        )

    def test_reports_version_drift_in_both_directions(self):
        local = [{"version": "20261001000000", "name": "local_only", "path": "a.sql"}]
        remote = [{"version": "20261002000000", "name": "remote_only"}]
        report = AUDIT.compare(local, remote)
        self.assertEqual(report["local_versions_absent_remotely"], ["20261001000000"])
        self.assertEqual(report["remote_versions_absent_locally"], ["20261002000000"])


if __name__ == "__main__":
    unittest.main()
