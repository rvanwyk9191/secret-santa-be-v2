# Tasks: Profile Completion

**Input**: [Specification](./spec.md), [plan](./plan.md), [research](./research.md), [data model](./data-model.md), [OpenAPI contract](./contracts/user-profile.openapi.yaml), and [quickstart](./quickstart.md).

**Format**: `[P]` marks work that can run in parallel with another task in the same phase once its prerequisites are met. `[US1]` and `[US2]` map to the specification's user stories. Mock DynamoDB, Auth0, and any external HTTP dependencies in Jest.

## Phase 1: Setup

- [X] T001 Confirm the backend and frontend build and test commands in `package.json` and `frontend/package.json`; establish a focused baseline for the existing dashboard and authentication tests and record any pre-existing failures before making changes.

## Phase 2: Shared Foundation

- [X] T002 [P] Add the `UserProfiles` DynamoDB table in `terraform/main.tf` with a string `email` partition key, no secondary index, and the repository's naming and environment conventions. Add a separate, table-scoped `GetItem`/`PutItem` grant in `terraform/compute.tf`; do not widen the existing table-operation or query permissions.
- [X] T003 [P] Normalize the verified JWT payload at the middleware boundary in `backend/src/auth/auth0.ts` and read `req.auth.payload['registered_user_email']` through a typed helper in `backend/src/utils/requestHelpers.ts`. Keep cookie extraction and signature, audience, and issuer checks unchanged; adapt auth fixtures such as `tests/integration/test_auth0.ts` and verify existing caller and member authorization with `tests/integration/test_profile_gift.ts`. Do not add a Bearer or OIDC-session fallback.
- [X] T004 [P] Add mocked service cases in `tests/unit/test_account_profile_service.ts` for an absent profile with no parties, persisted-name precedence, paginated legacy agreement and conflicts, and DynamoDB read failure. Verify reads never write.
- [X] T005 Implement shared profile resolution in `backend/src/services/accountProfileService.ts` against the data model: use normalized email and a consistent `UserProfiles` read, query all relevant `PartyMembers` pages only when a stored name is missing, and resolve each field independently. Return explicit nulls for unresolved names; log and propagate read errors without logging names.

**Checkpoint**: Shared name resolution works without a membership, and the authenticated caller identity still authorizes existing endpoints.

## Phase 3: User Story 1 - Complete My Name After Sign-In (P1, MVP)

**Independent test**: Sign in with an incomplete profile and no parties. Save both names, verify the dialog closes and the greeting changes without reloading, then sign in again and verify there is no prompt. Repeat with one known name and a failed save followed by retry.

- [X] T006 [P] [US1] Add completion cases in `tests/unit/test_account_profile_service.ts` for trimmed names, conditional creation and update, idempotent retry, conflicting completion, and distinct database failure.
- [X] T007 [P] [US1] Add contract and integration cases in `tests/contract/test_my_profile.ts` and `tests/integration/test_my_profile.ts` for the two `/api/me/profile` methods, exact response keys, `Cache-Control: no-store`, missing identity, rejected cross-origin writes, invalid JSON fields, wrong media type, and service errors. Verify a client-supplied account identifier cannot redirect the write.
- [X] T008 [P] [US1] Add focused frontend cases in `frontend/src/pages/MainPage.test.tsx`, `frontend/src/components/modals/CompleteProfile.test.tsx`, and `frontend/src/api/partyApi.test.ts` for complete and incomplete profiles, prefill, blank validation, duplicate-submit prevention, load/save retry, and successful header update.
- [X] T009 [US1] Implement atomic completion in `backend/src/services/accountProfileService.ts`: validate and trim both names without altering punctuation or case; require the observed stored values to remain unchanged before writing. On a conditional conflict, reread consistently and succeed only if the saved values match; otherwise return `409` with instructions to reload. Do not edit an effectively complete profile or modify membership records.
- [X] T010 [US1] Implement `GET` and `PUT /api/me/profile` in `backend/src/controllers/meController.ts`, using the mounted JWT-protected `meRouter` in `backend/src/controllers/index.ts`. Derive the target only from the verified caller; on `PUT`, check the configured browser origin, JSON media type, and exact body shape; return the structured status codes and no-store success responses from the contract.
- [X] T011 [P] [US1] Add the new endpoints and self-profile schemas to `docs/openapi.yaml`, matching `specs/007-profile-completion/contracts/user-profile.openapi.yaml`.
- [X] T012 [P] [US1] Add typed profile read/save helpers in `frontend/src/api/partyApi.ts` and their payload types in `frontend/src/types/api.ts`, reusing the existing same-origin cookie request pattern and distinguishing `409` from other save errors.
- [X] T013 [US1] Build the accessible **First Name**, **Last Name**, and **Save** dialog in `frontend/src/components/modals/CompleteProfile.tsx`; prefill any known names, reject blanks, disable duplicate submissions, and keep form inputs and a retry path visible on save failure.
- [X] T014 [US1] Integrate profile loading and the dialog in `frontend/src/pages/MainPage.tsx`. Keep loading and retry separate from party lists; open only for a successfully loaded incomplete profile and close after a confirmed save. Update the header from the response without reloading, and provide profile reload on `409`.

## Phase 4: User Story 2 - See Names in the Header and Party Cards (P2)

**Independent test**: Use a complete viewer profile and fixtures for joined parties and pending invitations whose host is not the viewer. Verify the header shows the viewer's name with no prompt, and both card types show the host's full name or host email if the name is incomplete.

- [X] T015 [P] [US2] Add list-response cases in `tests/integration/test_host_display_names.ts` for host/viewer separation, an omitted host field for partial names, one resolution per distinct host, and a logged enrichment failure that preserves the card payload.
- [X] T016 [P] [US2] Add name and email fallback cases in `frontend/src/components/PartyMemberCard.test.tsx` and `frontend/src/components/PendingInviteCard.test.tsx`; extend `frontend/src/pages/MainPage.test.tsx` to cover updating the caller's own host labels after save without relabeling other hosts.
- [X] T017 [US2] Add a request-scoped host resolver in `backend/src/services/accountProfileService.ts` and use it in `backend/src/services/meService.ts` and `backend/src/controllers/pendingInvitesController.ts`. Resolve each distinct `admin_email` once with bounded concurrency, include `host_display_name` only for complete host names, and log lookup errors while preserving existing list fields.
- [X] T018 [P] [US2] Document optional `host_display_name` on entries for `GET /me/parties` and `GET /me/pending-invites` in `docs/openapi.yaml`; preserve the existing response fields.
- [X] T019 [US2] Add `host_display_name` to both response types in `frontend/src/types/api.ts` and display it ahead of the existing host email in `frontend/src/components/PartyMemberCard.tsx` and `frontend/src/components/PendingInviteCard.tsx`. Keep all email identifiers and invitation actions unchanged.
- [X] T020 [US2] Use the confirmed save response in `frontend/src/pages/MainPage.tsx` to update visible card labels hosted by the caller only, without waiting for a refresh.

## Phase 5: Verification and Rollout

- [ ] T021 [P] Run backend and frontend builds and mocked test suites using `package.json` and `frontend/package.json`; check the coverage gate and report regressions or pre-existing blockers separately.
- [X] T022 [P] Run Terraform formatting and validation for `terraform/main.tf` and `terraform/compute.tf`; verify that the policy grants only the two required operations on the new table and that the deployment changes do not replace existing tables.
- [ ] T023 Follow `specs/007-profile-completion/quickstart.md` for the reviewed dev rollout: provision table and IAM before deploying the application, verify health and both story journeys with test identities, and preserve saved profiles on rollback. Do not apply infrastructure or deploy without approval.

## Dependencies and Parallel Work

**Verification status:** Both builds, both test suites, and Terraform validation passed against the staged feature without unrelated worktree edits. T021 remains open because backend line coverage is below 90%. T023 requires an approved non-production target and was not run.

- **Setup → Foundation**: T001 first. T002, T003, and T004 can run together; T005 follows T004 and uses the table contract from T002.
- **US1**: After foundation, T006, T007, and T008 can run together. T009 follows T006. T010 follows T007 and T009. T011 and T012 can run in parallel once the contract is agreed. T013 follows T008 and T012; T014 integrates T010 and T013.
- **US2**: After foundation, T015 and T016 can run together; split the dashboard test changes from T008 if working concurrently. T017 follows T015 and T009 because both edit the account service. T018 and T019 can run in parallel after the US1 changes to their shared files have landed. T020 follows T014, T017, and T019.
- **Verification**: T021 and T022 can run in parallel once both stories are complete; T023 follows both checks and requires deployment approval.

**Story dependency graph**: Setup → Foundation → US1 (MVP) → US2 integration → Verification and rollout. US2 list and card tests can start after Foundation without the completion dialog.

**Parallel examples**:

- **US1**: One contributor writes profile endpoint contract tests (T007) while another writes dashboard and dialog tests (T008).
- **US2**: One contributor writes host-list response tests (T015) while another writes card rendering tests (T016, after T008 for the shared dashboard test file).

## Implementation Strategy

Deliver **US1 as the MVP**: account storage, sign-in prompt, persistence, and full-name greeting. Then deliver **US2** as an additive change to the card feeds and labels. Test the stories with separate fixtures and release the new infrastructure before the frontend begins calling the new endpoints.
