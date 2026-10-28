#!/usr/bin/env python3
"""Read-only comparison of local Supabase migration filenames to a history snapshot.

This tool does not connect to Supabase, modify the database, rename migrations,
or infer that a missing filename means a migration is safe to apply.
"""
from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path

FILENAME_RE = re.compile(r"^(?P<version>\d{14})_(?P<name>.+)\.sql$")
PREFIX_RE = re.compile(r"^\d{14}_(?P<name>.+)$")


def normalize_name(name: str) -> str:
    """Remove a timestamp accidentally embedded in a remote logical name."""
    match = PREFIX_RE.match(name)
    return match.group("name") if match else name


def collect_local(migrations_dir: Path) -> list[dict[str, str]]:
    items = []
    for path in sorted(migrations_dir.glob("*.sql")):
        match = FILENAME_RE.match(path.name)
        if match:
            items.append({
                "version": match.group("version"),
                "name": match.group("name"),
                "path": path.name,
            })
    return items


def compare(local: list[dict[str, str]], remote: list[dict[str, str]]) -> dict:
    local_by_version: dict[str, list[dict[str, str]]] = defaultdict(list)
    remote_by_version: dict[str, list[dict[str, str]]] = defaultdict(list)
    local_by_name: dict[str, list[dict[str, str]]] = defaultdict(list)
    remote_by_name: dict[str, list[dict[str, str]]] = defaultdict(list)

    for item in local:
        local_by_version[item["version"]].append(item)
        local_by_name[item["name"]].append(item)
    for item in remote:
        remote_by_version[item["version"]].append(item)
        remote_by_name[normalize_name(item["name"])].append(item)

    duplicate_local_versions = {
        version: [item["path"] for item in items]
        for version, items in sorted(local_by_version.items()) if len(items) > 1
    }
    duplicate_remote_versions = {
        version: [item["name"] for item in items]
        for version, items in sorted(remote_by_version.items()) if len(items) > 1
    }
    exact_name_matches = []
    name_mismatches = []
    for name, local_items in sorted(local_by_name.items()):
        remote_items = remote_by_name.get(name, [])
        if remote_items:
            exact_name_matches.append({
                "name": name,
                "local_paths": [item["path"] for item in local_items],
                "remote_versions": [item["version"] for item in remote_items],
            })
    local_versions = set(local_by_version)
    remote_versions = set(remote_by_version)
    return {
        "local_file_count": len(local),
        "remote_record_count": len(remote),
        "duplicate_local_versions": duplicate_local_versions,
        "duplicate_remote_versions": duplicate_remote_versions,
        "local_versions_absent_remotely": sorted(local_versions - remote_versions),
        "remote_versions_absent_locally": sorted(remote_versions - local_versions),
        "logical_name_matches": exact_name_matches,
        "duplicate_local_names": {
            name: [item["path"] for item in items]
            for name, items in sorted(local_by_name.items()) if len(items) > 1
        },
        "duplicate_remote_names": {
            normalize_name(name): [item["version"] for item in items]
            for name, items in sorted(
                ((item["name"], [item]) for item in remote),
                key=lambda pair: pair[0],
            )
            if len(remote_by_name[normalize_name(name)]) > 1
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--migrations-dir", type=Path, default=Path("supabase/migrations"))
    parser.add_argument(
        "--history",
        type=Path,
        default=Path("supabase/migration-history-audit-2026-10-28.json"),
    )
    parser.add_argument("--json", action="store_true", help="Print the report as JSON")
    args = parser.parse_args()

    history_doc = json.loads(args.history.read_text(encoding="utf-8"))
    remote = history_doc.get("migrations", [])
    local = collect_local(args.migrations_dir)
    report = compare(local, remote)

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print(f"Local SQL files: {report['local_file_count']}")
        print(f"Remote history records in snapshot: {report['remote_record_count']}")
        print(f"Duplicate local versions: {len(report['duplicate_local_versions'])}")
        print(f"Duplicate remote versions: {len(report['duplicate_remote_versions'])}")
        print(f"Local versions absent remotely: {len(report['local_versions_absent_remotely'])}")
        print(f"Remote versions absent locally: {len(report['remote_versions_absent_locally'])}")
        print("\nIMPORTANT: differences require manual content/commit review; this report never authorizes applying migrations.")
        print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
