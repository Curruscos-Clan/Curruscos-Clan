# Supabase migration ledger reconciliation

**Audit snapshot:** 2026-10-11  
**Scope:** read-only comparison of `supabase/migrations/`, remote migration history, and selected live PostgreSQL definitions.  
**Safety:** this document records findings only. It does not change production schema or the remote migration ledger.

## Baseline

- Local repository contains **155 SQL migration files**.
- Remote Supabase migration history contains **178 records**.
- The latest remote history entry is `20261009172455 / secure_public_event_detail_updates`.
- There are **8 duplicate local timestamp prefixes**. These must be resolved only after mapping each file to its actual deployment history; do not rename them speculatively.
- Local migration filenames and remote migration names/versions do not align reliably. Name/version comparison alone cannot prove whether a schema change is deployed.

## Duplicate local timestamp prefixes

| Prefix | Files |
|---|---|
| `20261004162000` | `harden_invitation_mutation.sql`; `harden_plan_request_rpc_access.sql` |
| `20261004163500` | `centralize_event_trip_creation.sql`; `harden_race_result_participant_scope.sql` |
| `20261004170000` | `harden_competition_cross_event_integrity.sql`; `harden_trip_tenant_creator_immutability.sql` |
| `20261004220000` | `harden_team_follow_privacy.sql`; `harden_workspace_owner_invariants.sql` |
| `20261005170000` | `harden_chat_message_identity.sql`; `harden_persistent_team_event_registration_concurrency.sql` |
| `20261005172000` | `add_group_encryption_key_envelopes.sql`; `harden_direct_chat_creation_concurrency.sql` |
| `20261005173000` | `add_e2ee_payload_columns.sql`; `harden_chat_invitation_role_concurrency_batch.sql` |
| `20261009163000` | `move_public_event_editor_to_private_schema.sql`; `protect_task_identity_and_assignment.sql` |

## Live-definition checks

These are functional checks against the remote schema, not conclusions drawn from migration names alone.

| Area | Observed remotely | Local migration to reconcile | Initial classification |
|---|---|---|
| Public event registration | `join_public_event(uuid)` does not reject a registration solely because the event's start time has passed, and does not derive the start instant using the group's timezone. | `20261009190000_harden_public_event_registration_lifecycle.sql` | **Not reflected in live function** |
| Participant status authorization | `set_event_participant_status(uuid, uuid, text)` still uses nullable authorization comparisons without the newer null-safe guards. | `20261010120000_null_safe_participant_status_authorization.sql` | **Not reflected in live function** |
| Public participant counts | `public.get_public_event_participant_counts(uuid[])` was not present in the remote function catalogue queried during this audit. | `20261010140000_safe_public_event_participant_counts.sql` | **Partial/ambiguous**: aggregate RPC absent; compare all table policies and UI calls |
| Anonymous event detail policies | Remote policy `Event team members visible to event viewers` still targets `{authenticated,anon}`; `Public can view race results for public events` also targets `{authenticated,anon}`. | `20261010150000_restrict_anonymous_event_details.sql` | **Not reflected in live policies** |
| Public profile privacy | `get_public_profile(uuid)` does not require the target to have qualifying public activity before returning a profile. | `20261010130000_require_public_activity_for_public_profile.sql` | **Not reflected in live function** |
| Event/trip creation wrappers | `create_group_event` and `create_trip` definitions still show a non-empty `search_path` and are not `SECURITY DEFINER`. | `20261010160000_fix_event_trip_wrapper_permissions.sql` | **Not reflected in live functions** |

Other recent files requiring explicit policy/function comparison include:

- `20261009200000_allow_anon_public_participant_counts.sql`
- `20261010100000_null_safe_event_organizer_authorization.sql`
- `20261010110000_null_safe_team_match_and_trip_authorization.sql`
- `20261010150000_restrict_anonymous_event_details.sql`

## Reconciliation procedure

1. Export a fresh remote migration ledger and capture definitions for every affected function, policy, trigger, and grant.
2. Build a mapping table with one row per local SQL file: local path/hash, originating commit, candidate remote migration/version, functional schema evidence, and status (**applied**, **not applied**, or **ambiguous**).
3. For every ambiguous row, inspect Git history and compare the actual SQL semantics. Do not infer deployment from a similar name.
4. Reconstruct the repository migration sequence on an isolated PostgreSQL/Supabase database and run the existing registration, participant privacy, profile privacy, and wrapper-permission regression tests.
5. Review any proposed production rollout separately, including a rollback plan and post-deployment verification.

## Explicit guardrails

- Do not edit the remote migration ledger manually.
- Do not apply these migrations to production as part of this reconciliation.
- Do not rename duplicate-timestamp files until the deployment mapping is established.
- Do not merge a reconciliation branch merely because static checks pass; the isolated replay and security regression tests must pass first.
