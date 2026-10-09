# Regression plan — public event registration lifecycle

Branch: `audit/event-registration-lifecycle`  
Related migration: `supabase/migrations/20261009190000_harden_public_event_registration_lifecycle.sql`

## Scope and execution status

This is a regression checklist, not evidence that tests have passed. The repository currently has no discoverable Vitest/Jest/Playwright test setup, and the Supabase preview branch could not be created on the current plan. Run these checks against a disposable development database before merging or applying the migration to production. Do not use production data for test fixtures.

## Fixtures

Prepare separate authenticated users for: event organizer, ordinary user A, ordinary user B, group member, and non-member. Prepare:
- a standalone public standard event in the future, published, with capacity 2 and a future registration deadline;
- a public event whose start time is in the past but whose deadline is still in the future;
- an event with an expired registration deadline;
- an event at capacity;
- a group event with a non-default IANA time zone;
- a public competition event in `knockout`, `round_robin`, or `swiss` format with and without matches;
- a draft, cancelled, and finished event.

Use test-only accounts and remove fixtures after testing.

## A. Joining and capacity

| ID | Action | Expected result |
|---|---|---|
| REG-01 | Call `join_public_event` unauthenticated | Rejected with `NOT_AUTHENTICATED`; no participant row inserted |
| REG-02 | User A joins a future published public event | Success `JOINED`; exactly one `yes` row |
| REG-03 | User A joins the same event again | Idempotent success `ALREADY_JOINED`; still one row |
| REG-04 | User B joins after two users are confirmed in capacity-2 event | Rejected with `EVENT_FULL`; no extra `yes` row |
| REG-05 | User joins an event after its registration deadline | Rejected with `REGISTRATION_CLOSED` |
| REG-06 | User joins a published event whose start has passed but deadline has not | Rejected with `EVENT_STARTED` |
| REG-07 | Join an event in `preparing`, `live`, `finished`, or `cancelled` | Rejected as closed; no row inserted |
| REG-08 | User attempts to join an inaccessible private group event | Rejected with `NO_ACCESS` |
| REG-09 | User with an existing `no` or `pending` row joins a valid event | Existing row becomes `yes`; no duplicate row |
| REG-10 | Two users attempt to take the final available place concurrently | At most one succeeds; confirmed count never exceeds capacity |

## B. Time-zone handling

| ID | Action | Expected result |
|---|---|---|
| TZ-01 | Attempt to join before start for a group with a valid non-default time zone | Join is allowed if all other rules pass |
| TZ-02 | Attempt to join after start in that same group time zone | Rejected with `EVENT_STARTED` |
| TZ-03 | Repeat with a browser configured to a different time zone | Server result is unchanged |
| TZ-04 | Standalone event without a group time zone | Fallback is `Europe/Madrid`; verify before/after start boundaries |

Test daylight-saving transitions separately. Confirm the intended product rule for ambiguous/nonexistent local times before treating those edge cases as passing.

## C. Organizer state transitions

| ID | From → to | Expected result |
|---|---|---|
| ST-01 | `draft` → `published` | Allowed for organizer |
| ST-02 | `draft` → `cancelled` | Allowed for organizer |
| ST-03 | `published` → `preparing` / `live` / `finished` / `cancelled` | Allowed only when existing competition guards also pass |
| ST-04 | `preparing` → `live` / `finished` / `cancelled` | Allowed only when existing competition guards also pass |
| ST-05 | `live` → `finished` / `cancelled` | Allowed only when existing competition guards also pass |
| ST-06 | `cancelled` or `finished` → any different state | Rejected |
| ST-07 | Any state → same state | Idempotent request succeeds, subject to existing competition guards |
| ST-08 | Non-organizer attempts any state change | Rejected with permission error |
| ST-09 | Competition enters `live` without matches | Rejected |
| ST-10 | Competition enters `finished` with scheduled/live matches | Rejected |

Also verify the organizer UI only offers allowed next states, hides the selector for terminal states, and displays server errors without leaving the control stuck disabled.

## D. Participant privacy and UI compatibility

| ID | Viewer | Expected visibility |
|---|---|---|
| RLS-01 | Participant | Can read their own row, including their own `pending` or `no` status |
| RLS-02 | Organizer of a standalone event | Can read all rows for that event, including `pending` and `no` |
| RLS-03 | Member of the event's group | Can read group participation as intended by the current group policy |
| RLS-04 | Authenticated stranger | Can read only confirmed `yes` participants of public events in allowed public states |
| RLS-05 | Anonymous visitor | Can query only confirmed `yes` rows for public events in allowed states; cannot see `pending`/`no` rows or private/unlisted events |
| RLS-06 | Public event listing | Embedded `event_participants(count)` still returns the correct confirmed count |
| RLS-07 | Public participant RPC | Returns only confirmed participants for public events in its allowed states |
| RLS-08 | Private/unlisted event | No participant data leaks to unrelated authenticated users |

Check browser network responses as well as rendered UI; hiding data in the interface alone is not sufficient.

## E. Release gate

Do not merge until:
- [ ] SQL migration applies cleanly to a disposable database with the current schema.
- [ ] All cases above pass, or any intentional deviations are documented.
- [ ] Confirmed participant counts still work through PostgREST after the RLS change.
- [ ] Existing group organizer/member workflows remain functional.
- [ ] The migration has been reviewed for grants, RLS, and `SECURITY DEFINER` behavior.
- [ ] Production remains unchanged until the owner explicitly approves rollout.


## F. Authorization null-safety audit (follow-up finding)

The production schema currently allows `events.created_by` to be NULL (the column is nullable), and at least one event has no `group_id`. The current sample has no events with a NULL creator, but the schema still permits that state. Authorization predicates such as `e.created_by <> actor` can evaluate to SQL NULL rather than TRUE when the creator is NULL; PL/pgSQL `IF` does not enter its branch for a NULL condition. This can bypass a rejection check if the function relies on that predicate alone.

Before release, review and test every event/competition `SECURITY DEFINER` function that uses this pattern, especially `is_public_event_organizer`, `set_public_event_status`, `generate_knockout_bracket`, `generate_round_robin_schedule`, `generate_swiss_round`, and `create_event_team`.

| ID | Action | Expected result |
|---|---|---|
| AUTH-01 | Call organizer-only RPC as an authenticated non-member against a fixture whose `created_by` is NULL | Rejected; no state or match/team rows changed |
| AUTH-02 | Call organizer-only RPC as authenticated non-member against a standalone event with `group_id` NULL and a valid, different creator | Rejected |
| AUTH-03 | Call the organizer helper when the caller is neither creator nor group owner/admin | Returns strict FALSE, never NULL |
| AUTH-04 | Repeat the above as the event creator and as a group owner/admin | Allowed only where the function's documented authorization policy permits it |

Potential remediation: use explicit null-safe checks such as `e.created_by IS DISTINCT FROM actor` and make helper functions return a non-null boolean. Apply only after reviewing each function's intended policy and testing it against a disposable database; do not run a bulk production rewrite.
