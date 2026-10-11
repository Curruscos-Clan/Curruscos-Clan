"""Guardrail for migration versions that collide in the standard Supabase ledger."""
from collections import defaultdict
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS = ROOT / "supabase" / "migrations"
AUDIT_DOC = ROOT / "docs" / "supabase-migration-ledger-reconciliation.md"
EXPECTED_DUPLICATE_PREFIXES = {
    "20261004162000",
    "20261004163500",
    "20261004170000",
    "20261004220000",
    "20261005170000",
    "20261005172000",
    "20261005173000",
    "20261009163000",
}


class DuplicateMigrationPrefixDocumentationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        by_prefix = defaultdict(list)
        for path in MIGRATIONS.glob("*.sql"):
            match = re.match(r"^(\d{14})_(.+)\.sql$", path.name)
            if match:
                by_prefix[match.group(1)].append(path.name)
        cls.duplicates = {prefix: sorted(names) for prefix, names in by_prefix.items() if len(names) > 1}
        cls.doc = AUDIT_DOC.read_text(encoding="utf-8") if AUDIT_DOC.is_file() else ""

    def test_duplicate_prefix_inventory_matches_audited_set(self):
        self.assertEqual(
            set(self.duplicates),
            EXPECTED_DUPLICATE_PREFIXES,
            "Duplicate migration prefixes changed; review the migration inventory and update the audit deliberately.",
        )
        self.assertTrue(all(len(names) == 2 for names in self.duplicates.values()), self.duplicates)

    def test_every_duplicate_prefix_and_filename_is_documented(self):
        self.assertTrue(AUDIT_DOC.is_file(), "Migration reconciliation audit document is missing.")
        undocumented = {
            prefix: names
            for prefix, names in self.duplicates.items()
            if f"`{prefix}`" not in self.doc or any(name[len(prefix) + 1:] not in self.doc for name in names)
        }
        self.assertFalse(
            undocumented,
            "Every duplicate prefix and both filenames must be recorded in the reconciliation audit: "
            + repr(undocumented),
        )
        self.assertIn("Keep all migration filenames unchanged until a tested remediation is reviewed.", self.doc)


if __name__ == "__main__":
    unittest.main()
