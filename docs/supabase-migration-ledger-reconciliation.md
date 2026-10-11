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


## Additional Supabase advisor review

The live security advisor reports **10 functions executable by `anon` as `SECURITY DEFINER`**. This count is not, by itself, proof of a vulnerability: several are explicitly named public discovery APIs (public people, teams, rankings, public event relationships, and public profiles). Their intended anonymous access should be preserved only where the function body enforces public visibility and excludes private-only data.

Read-only inspection of representative definitions found public-event/status filters in `get_public_active_people`, `get_public_active_teams`, `get_public_event_participants`, `get_public_event_team_members`, `get_public_persistent_team`, `get_public_persistent_team_events`, `get_public_profile_activity`, `get_public_profile_teams`, `get_public_race_results`, and `get_public_rankings`. The main `get_public_profile` still lacks the public-activity row guard in the live definition, as noted above.

The advisor also reports **78 authenticated-executable SECURITY DEFINER functions**. This is likewise a review signal rather than a recommendation to revoke all access: RPCs are used for authorized mutations and reads, and each must retain the correct grant boundary plus internal authorization checks. Do not blanket-revoke or convert these functions without call-site and behavior tests.

## Suggested next regression coverage

- Assert anonymous users cannot read raw participant/team-member/race-result rows through table policies, while intended public RPCs return only public-event data.
- Assert the public-profile RPC returns zero rows for users whose only activity is private, draft, or cancelled.
- Assert event registration fails after the event start instant in the group's timezone and after the registration deadline, while respecting capacity under concurrent attempts.
- Assert wrapper RPCs remain callable by authenticated users but not `anon`, and that private helper functions cannot be called directly by either client role.
- Re-run the Supabase security advisor after a reviewed rollout; classify expected public discovery RPCs separately from unintended exposure.


## Isolated regression test results (2026-10-11)

The following GitHub Actions checks passed on the audit branch after adding a dedicated PostgreSQL test for `20261010150000_restrict_anonymous_event_details.sql`:

- Public profile privacy regression tests: **success**.
- Event/trip wrapper permission tests: **success**.
- Anonymous event-detail row-access test: **success**.
- Public event lifecycle regression tests, including the participant authorization PostgreSQL test: **success**.

The new test is `supabase/tests/test_anonymous_event_detail_policies_postgres.sql`. It reproduces both legacy policies targeting `anon`, applies the migration in disposable PostgreSQL, and verifies that the resulting team-member and race-result policies target only `authenticated` and preserve visibility/status predicates.

**Scope limitation:** these are isolated tests for selected recent migrations, not a complete replay of all 155 repository migrations. Do not interpret them as production rollout approval.


## Follow-up runtime impact check (2026-10-11)

A second read-only query confirmed that the missing aggregate-count RPC has a direct frontend impact:

- The live schema has **no** `public.get_public_event_participant_counts(uuid[])` function.
- `js/supabase.js` calls that RPC in both the single-event participant count helper and the public event discovery feed.
- The discovery-feed error branch deliberately returns each event with `participant_count: 0`; therefore, until the RPC is deployed or the client is made compatible with the live schema, public event cards can show zero participants even when confirmed participants exist.
- The live `event_participants` SELECT policy is still the older broad policy `Authenticated users can view event participation`, which exposes participant rows for public published/finished events to signed-in users without restricting the row to confirmed status or the viewer being the participant/manager. This differs from the latest local migration that limits row access to the user themselves and event managers. A privilege check also confirms that `anon` and `authenticated` both have table-level SELECT grants on all three tables; RLS still applies, but the live policies for `event_team_members` and `event_race_results` explicitly allow anonymous reads of qualifying public-event rows.
- Live `event_team_members` and `event_race_results` policies still include `anon`. The local restriction migration is not reflected in the live policy catalog.
- Live `create_group_event` and `create_trip` wrappers are callable by `authenticated` and not by `anon`, but remain invoker functions with a non-empty search path. Their private helper functions are protected from direct client execution. This means the wrapper-permission migration is only partially reflected: grants are compatible, but the requested execution/search-path hardening is not.

These results increase confidence that the recent local migrations have not been applied as a coherent batch, but they do **not** establish which deployment operation should be performed next. The safe next step remains to reconstruct the migration sequence in an isolated database, verify frontend behavior against that schema, and prepare a separately reviewed rollout plan. No production changes were made during this follow-up.


## Post-ledger migration gap (confirmed timestamp boundary, 2026-10-11)

The remote ledger ends at version `20261009172455` (`secure_public_event_detail_updates`). The local repository contains the following later migration files whose versions are beyond that boundary and do not appear in the remote ledger:

| Local migration | What it intends to change | Runtime evidence |
|---|---|---|
| `20261009190000_harden_public_event_registration_lifecycle.sql` | Reject late registration and interpret event start in the group's timezone | Live `join_public_event(uuid)` lacks these checks |
| `20261009200000_allow_anon_public_participant_counts.sql` | Allow safe aggregate counts without exposing participant rows | Aggregate RPC is absent from the live catalogue |
| `20261010100000_null_safe_event_organizer_authorization.sql` | Make organizer authorization null-safe | Requires function-by-function confirmation before classification |
| `20261010110000_null_safe_team_match_and_trip_authorization.sql` | Harden team/match/trip authorization | Requires function-by-function confirmation before classification |
| `20261010120000_null_safe_participant_status_authorization.sql` | Make participant status authorization null-safe | Live `set_event_participant_status` still has nullable comparisons |
| `20261010130000_require_public_activity_for_public_profile.sql` | Require qualifying public activity before exposing a profile | Live `get_public_profile(uuid)` lacks the final activity gate |
| `20261010140000_safe_public_event_participant_counts.sql` | Add a safe public aggregate count RPC | `get_public_event_participant_counts(uuid[])` is absent |
| `20261010150000_restrict_anonymous_event_details.sql` | Restrict direct event-detail row reads to authenticated users | Live team-member and race-result policies still include `anon` |
| `20261010160000_fix_event_trip_wrapper_permissions.sql` | Harden event/trip wrapper execution context | Live wrappers are not `SECURITY DEFINER` and retain non-empty search paths |

The timestamp boundary plus the live-definition mismatches make these post-boundary migrations strong candidates for **not deployed**, rather than merely renamed. This is still not proof that every SQL file is absent from the schema: some changes may have been applied manually or combined into other migrations. Treat each row as a candidate for isolated replay and rollout planning, not as authorization to run it against production.

The public event-count helper is defined by more than one local migration, so the intended final definition and grants must be resolved by replaying the ordered files together. Do not deploy only the later file or manually insert a ledger row to make the history look aligned.
