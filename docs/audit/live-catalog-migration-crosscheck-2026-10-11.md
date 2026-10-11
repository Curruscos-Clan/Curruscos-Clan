# Read-only live catalog cross-check for migration audit — 2026-10-11

## Scope

This note records a read-only catalog query and GitHub path-history checks. No schema or migration ledger writes were performed.

## Live catalog observations

The live PostgreSQL catalog currently shows:

- `public.validate_event_team_member_event()` with an empty function search path.
- The team functions covered by local migration `20261004251000_harden_remaining_team_function_paths.sql` with the expected empty search path.
- The chat/social functions covered by local migration `20261004252000_harden_chat_social_function_paths.sql` with search path `pg_catalog, public, auth, pg_temp`.
- `public.enforce_group_member_plan_limit()` present with search path `public, pg_temp`.
- `public.log_recommendation_impression(...)` present with search path `pg_catalog, public, auth, pg_temp`.

These observations confirm current live function configuration, not the ledger row that introduced it. Another migration or a direct schema change could have produced the same live state.

## Git path-history observations

GitHub's path-specific commit history returned no commits for these earlier-version filenames:

- `20261004182519_harden_event_team_member_trigger_path.sql`
- `20261004182610_harden_remaining_team_function_paths.sql`
- `20261004182659_harden_chat_social_function_paths.sql`
- `20261003101759_enforce_workspace_plan_limits.sql`
- `20261003115025_enforce_workspace_plan_limits.sql`
- `20261007144651_add_recommendation_impressions.sql`
- `20261007144721_add_recommendation_impressions.sql`

The later local files have Git history under `20261004250000`, `20261004251000`, `20261004252000`, and `20261007183000`.

Absence of an exact path from reachable Git history does not prove the file never existed in another branch, working copy, or deployment artifact.

## Conclusion and guardrails

The relevant live hardening settings exist, but the original mapping of repeated remote ledger rows remains unresolved. Matching function names or settings are not enough to prove which migration row applied a body. Do not rename local files, replay candidate migrations, or alter the remote ledger until deployment provenance or a verified baseline resolves the mapping.

The five repeated remote names remain:
- `enforce_workspace_plan_limits` — versions `20261003101759`, `20261003115025`
- `harden_event_team_member_trigger_path` — versions `20261004182519`, `20261004250000`
- `harden_remaining_team_function_paths` — versions `20261004182610`, `20261004251000`
- `harden_chat_social_function_paths` — versions `20261004182659`, `20261004252000`
- `add_recommendation_impressions` — versions `20261007144651`, `20261007144721`

This document supplements the main reconciliation report; it does not supersede it.
