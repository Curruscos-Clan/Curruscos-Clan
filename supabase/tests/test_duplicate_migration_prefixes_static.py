"""Guardrail for migration versions that collide in the standard Supabase ledger."""
from collections import defaultdict
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS = ROOT / "supabase" / "migrations"
AUDIT_DOC = ROOT / "docs" / "supabase-migration-ledger-reconciliation.md"


class DuplicateMigrationPrefixDocumentationTests(unittest.TestCase):
    def test_every_duplicate_timestamp_is_explicitly_documented(self):
        by_prefix = defaultdict(list)
        for path in MIGRATIONS.glob("*.sql"):
            match = re.match(r"^(\d{14})_(.+)\.sql$", path.name)
            if match:
                by_prefix[match.group(1)].append(path.name)

        duplicates = {prefix: names for prefix, names in by_prefix.items() if len(names) > 1}
        self.assertTrue(duplicates, "Expected this guardrail to exercise the repository's known duplicate prefixes.")
        self.assertTrue(AUDIT_DOC.is_file(), "Migration reconciliation audit document is missing.")
        doc = AUDIT_DOC.read_text(encoding="utf-8")

        undocumented = {prefix: names for prefix, names in duplicates.items() if f"`{prefix}`" not in doc}
        self.assertFalse(
            undocumented,
            "Every duplicate migration timestamp must be recorded in the reconciliation audit before changes are proposed: "
            + repr(undocumented),
        )
        self.assertIn("Keep all migration filenames unchanged until a tested remediation is reviewed.", doc)


if __name__ == "__main__":
    unittest.main()
