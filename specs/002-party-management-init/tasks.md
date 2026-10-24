# Tasks: Party Management, Auth0 Registration, and SNS Notification

**Input**: Design documents from `/specs/002-party-management-init/`
**Prerequisites**: plan.md (required), spec.md (required for user stories)

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Create project structure per implementation plan
- [x] T002 Initialize Node.js/TypeScript project with required dependencies (aws-sdk, auth0, jest)
- [x] T003 [P] Configure linting and formatting tools (eslint, prettier)
- [x] T004 [P] Setup Terraform project for AWS infrastructure

---

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T005 Setup DynamoDB tables: Parties, PartyMembers, Invitations, Assignments, NotificationEvents
- [X] T006 [P] Implement Auth0 authentication/authorization integration in src/auth/
- [X] T007 [P] Setup API routing and middleware structure in src/controllers/
- [X] T008 Create base models/entities in src/models/
- [X] T009 Configure error handling and logging infrastructure in src/utils/
- [X] T010 Setup environment configuration management (SSM Parameter Store)

---

## Phase 3: User Story 1 - Party Creation (Priority: P1) 🎯 MVP

**Goal**: Allow authenticated users to create parties and become party administrators.
**Independent Test**: Creating a party returns a valid party_id and saves the administrator email.

- [x] T011 [P] [US1] Contract test for POST /api/parties in tests/contract/test_create_party.ts
- [x] T012 [P] [US1] Integration test for party creation in tests/integration/test_party_creation.ts
- [x] T013 [P] [US1] Implement Party model in src/models/party.ts
- [x] T014 [US1] Implement party creation service in src/services/partyService.ts
- [x] T015 [US1] Implement POST /api/parties endpoint in src/controllers/partyController.ts
- [x] T016 [US1] Add validation and error handling for party creation
- [x] T017 [US1] Add logging for party creation operations

---

## Phase 3.1: Short Party ID with Collision Check (Correction)

**Goal**: Replace the full UUID v4 `party_id` with the first 8-character hex segment (e.g. `e876dd4f`). Before assigning the ID, query DynamoDB to confirm it is not already in use. Regenerate until a unique ID is found. Activate the DynamoDB `put` for party persistence as part of this phase.

- [x] T017a [US1] Update `src/services/partyService.ts` — generate `party_id` as `uuidv4().split('-')[0]`; loop with a DynamoDB `GetCommand` on the `Parties` table to check for collision; regenerate until the ID is unique; log each collision if one occurs
- [x] T017b [US1] Activate DynamoDB `PutCommand` in `src/services/partyService.ts` to persist the party after a unique ID is confirmed; replace the existing `// TODO` comment with a real `dynamoClient.send(new PutCommand(...))`
- [x] T017c [P] [US1] Activate DynamoDB `GetCommand` in `getParty` in `src/services/partyService.ts` — replace the existing `// TODO` comment with a real `dynamoClient.send(new GetCommand(...))`

---

## Phase 2.1: Error Handling — Constitution v1.5 Compliance

**Goal**: Wrap all downstream calls (DynamoDB, SNS, SSM/Auth0 startup) in `try/catch`. Caught errors MUST be logged with `Logger.error` before re-throwing. A global Express error handler MUST return a structured HTTP 500 response so unhandled service errors never crash the process.

**Blocking**: MUST be complete before Phase 5. All new service code from Phase 3 onward MUST adhere to this pattern from the start.

**Scope audit:**
- `src/utils/config.ts` — ✅ already wrapped (skip)
- `src/controllers/partyController.ts` — ✅ already wrapped with `try/catch → next(err)` (skip)
- `src/controllers/invitationController.ts` — ✅ already wrapped with `try/catch → next(err)` (skip)
- `src/services/partyService.ts` — DynamoDB calls unprotected ❌
- `src/services/notificationService.ts` — SNS `snsClient.send()` unprotected ❌
- `src/services/invitationService.ts` — `publishNotification()` call unprotected ❌
- `src/auth/authRouter.ts` + `src/auth/auth0.ts` — SSM errors propagate raw without `Logger.error` ❌
- `src/controllers/index.ts` — no global Express error-handler middleware (4-arg) ❌

- [x] T017d Add `try/catch` to all DynamoDB calls in `src/services/partyService.ts` — wrap `generateUniquePartyId()`, `createParty()`, and `getParty()`; catch block MUST call `Logger.error` with context and re-throw
- [x] T017e Add `try/catch` to `snsClient.send()` in `src/services/notificationService.ts` — catch block MUST call `Logger.error` with `payload.type` and `payload.party_id` as context and re-throw
- [x] T017f Add `try/catch` to `publishNotification()` call in `src/services/invitationService.ts` — catch block MUST call `Logger.error` with party and email context and re-throw
- [x] T017g Add `try/catch` to the SSM `Promise.all` in `createAuthMiddleware()` in `src/auth/authRouter.ts` — catch block MUST call `Logger.error('authRouter: failed to load SSM config', ...)` and re-throw
- [x] T017h Add `try/catch` to the SSM `Promise.all` in `createCheckJwt()` in `src/auth/auth0.ts` — catch block MUST call `Logger.error('auth0: failed to load SSM config', ...)` and re-throw
- [x] T017i Add global Express error-handler middleware in `src/controllers/index.ts` — 4-argument handler `(err, req, res, next)` registered after all routes; MUST log via `Logger.error` and respond with `res.status(500).json({ error: { message: 'Internal server error' } })`
- [x] T017j [P] Add unit tests in `tests/unit/test_error_handling.ts` — assert that DynamoDB rejection in `partyService` causes `Logger.error` to be called; assert that SNS rejection in `notificationService` causes `Logger.error` to be called; assert that the global error handler returns HTTP 500 JSON
- [x] T017k Update `specs/002-party-management-init/plan.md` — mark Error Handling Constitution Check gate as ✅ once T017d–T017i are complete

---

## Phase 2.2: Test Mocking — Constitution v1.6 Compliance

**Goal**: Ensure every existing Jest test mocks all downstream AWS SDK calls. No test may make real network calls to DynamoDB, SNS, SSM, or Auth0. Fixes the pre-existing `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG` failure in `tests/integration/test_party_creation.ts`.

**Scope audit:**
- `tests/contract/test_create_party.ts` — ✅ no real AWS calls; uses a local mock object only (skip)
- `tests/integration/test_invitation.ts` — ✅ mocks `notificationService` (skip)
- `tests/integration/test_auth0.ts` — ✅ mocks `config.js`, `jwks-rsa`, `express-jwt` (skip)
- `tests/unit/test_auth_router.ts` — ✅ mocks `config.js`, `express-openid-connect` (skip)
- `tests/unit/test_auth0_config.ts` — ✅ mocks `config.js`, `jwks-rsa`, `express-jwt` (skip)
- `tests/unit/test_error_handling.ts` — ✅ mocks `dynamodb.js`, `@aws-sdk/client-sns` (skip)
- `tests/integration/test_party_creation.ts` — ❌ calls real `createParty` with no DynamoDB mock; fails with `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG` in CI

- [x] T017l Add `jest.mock('../../src/utils/dynamodb.js')` and `jest.mock('uuid')` to `tests/integration/test_party_creation.ts` — mock `dynamoClient.send` to return `{ Item: undefined }` for the collision-check `GetCommand` and resolve successfully for the `PutCommand`; mock `uuid` to return a deterministic value so `party_id` is predictable; assert all existing party shape assertions still pass
- [x] T017m Update `specs/002-party-management-init/plan.md` — mark Test Mocking Constitution Check gate as ✅ once T017l is complete and all tests pass

---

## Phase 4: User Story 2 - Invitations (Priority: P2)

**Goal**: Allow administrators to invite participants by email and send invitation links.
**Independent Test**: Invited users receive an email with a valid party_id and token.

- [x] T018 [P] [US2] Contract test for POST /api/parties/{party_id}/invitations in tests/contract/test_invite.ts
- [x] T019 [P] [US2] Integration test for invitation flow in tests/integration/test_invitation.ts
- [x] T020 [P] [US2] Implement Invitation model in src/models/invitation.ts
- [x] T021 [US2] Implement invitation service in src/services/invitationService.ts
- [x] T022 [US2] Implement POST /api/parties/{party_id}/invitations endpoint in src/controllers/invitationController.ts
- [x] T023 [US2] Integrate AWS SNS for sending invitation emails in src/services/notificationService.ts
- [x] T024 [US2] Add validation and error handling for invitations
- [x] T025 [US2] Add logging for invitation operations

---

## Phase 4.5: Auth0 SSM Configuration (Priority: P0 — Constitutional Prerequisite)

**Goal**: Replace environment variable Auth0 config with SSM Parameter Store retrieval, per constitution v1.1.
**Blocking**: MUST be completed before Phase 5 (T026+). No Auth0-protected route may be put into use until this is done.

- [x] T025a [AUTH] Update `src/auth/auth0.ts` to retrieve `domain` and `audience` from SSM at `/secret-santa/auth0/domain` and `/secret-santa/auth0/audience` using the existing `config.ts` SSM helper
- [x] T025b [AUTH] Update `src/auth/auth0.ts` to retrieve `client_id` and `client_secret` from SSM at `/secret-santa/auth0/client_id` and `/secret-santa/auth0/client_secret` — remove hardcoded env-var fallbacks
- [x] T025c [AUTH] Unit test for SSM-based Auth0 config retrieval in `tests/unit/test_auth0_config.ts` (mock SSM client)
- [x] T025d [AUTH] Integration test for `checkJwt` middleware initialised with SSM-sourced config in `tests/integration/test_auth0.ts`

---

## Phase 4.6: Auth0 Login Flow (Priority: P0 — Testing Prerequisite)

**Goal**: Implement Auth0 Authorization Code Flow so users can authenticate and receive a JWT to test all protected routes.
**Blocking**: MUST be completed before Phase 5 and before any manual or integration testing of JWT-protected endpoints.
**Auth0 Flow**: Authorization Code Flow via `express-openid-connect` (Auth0 default for Express). Credentials sourced from SSM (constitution v1.3).

- [x] T025e [P] [AUTH] Install `express-openid-connect` and `@types/express-openid-connect` (devDep) — add to package.json
- [x] T025f [AUTH] Create `src/auth/authRouter.ts` — mount `auth()` middleware from `express-openid-connect`; source `baseURL`, `clientID`, `clientSecret`, and `issuerBaseURL` from SSM at `/secret-santa/auth0/*`; export `authRouter` with `GET /auth/login`, `GET /auth/callback`, and `GET /auth/logout` handled by the library
- [x] T025g [AUTH] Update `src/controllers/index.ts` — import and mount `authRouter` at `/api`; call `createCheckJwt()` at startup and apply the returned middleware to all routes except `/health`, `/auth/login`, `/auth/callback`, and `/auth/logout`
- [x] T025h [P] [AUTH] Unit test for auth router config in `tests/unit/test_auth_router.ts` — mock SSM responses, assert that `baseURL`, `clientID`, `clientSecret`, and `issuerBaseURL` are sourced from the correct SSM paths
- [x] T025i [AUTH] Update `specs/002-party-management-init/plan.md` — add Auth0 Login Flow gate to Constitution Check table
- [x] T025j [AUTH] Add logging for auth flow lifecycle events in `src/auth/authRouter.ts` (login initiated, callback received, logout initiated)

---

## Phase 4.7: Security / HTTPS Enforcement (Constitution v1.4)

**Goal**: Enforce the constitution v1.4 HTTPS requirement at runtime and in tests. All deployed `BASE_URL` values must use `https://`; `http://` is only valid when the host is `localhost`.
**Blocking**: MUST be completed before Phase 5. No deployment configuration should be accepted without HTTPS validation in place.

- [x] T025k [AUTH] Add runtime HTTPS guard in `src/auth/authRouter.ts` — after resolving `BASE_URL`, assert it starts with `https://` unless host is `localhost`; throw `Error('BASE_URL must use HTTPS in deployed environments')` on violation
- [x] T025l [P] [AUTH] Add unit test in `tests/unit/test_auth_router.ts` — assert that `createAuthMiddleware()` throws when `BASE_URL` is a non-localhost `http://` URL; assert it does NOT throw for `http://localhost:3000`
- [x] T025m [AUTH] Update `specs/002-party-management-init/plan.md` — mark Security/HTTPS Constitution Check gate as ✅ once T025k and T025l are complete

---

## Phase 4.8: Auth0 Callback Cookie Fix

**Goal**: Resolve `BadRequestError: "auth_verification" cookie not found` that occurs during the Auth0 Authorization Code Flow callback.

**Root cause**: `express-openid-connect` sets the `auth_verification` transaction cookie during the login redirect. When the browser follows the cross-site redirect back from Auth0, the cookie is silently dropped unless `SameSite=None; Secure` is explicitly configured. The library only auto-configures this when it can detect HTTPS from the request, which is unreliable with self-signed certs on `127.0.0.1`.

**Blocking**: MUST be completed before the Auth0 login flow can be end-to-end tested.

- [x] T025n [AUTH] Add explicit `transactionCookie` and `session.cookie` config to the `auth()` call in `src/auth/authRouter.ts` — set `transactionCookie: { sameSite: 'None', secure: true }` and `session: { cookie: { secure: true, sameSite: 'None' } }` to ensure cookies survive the cross-site callback redirect from Auth0
- [x] T025o [P] [AUTH] Update unit test in `tests/unit/test_auth_router.ts` — assert that `auth()` is called with `transactionCookie` containing `sameSite: 'None'` and `secure: true`, and `session.cookie` containing `secure: true`

---

## Phase 4.7.1: Auth0 Custom Claim — `registered_user_email`

**Goal**: All code that reads the user's email from a JWT access token MUST use the custom claim `registered_user_email` set by the Auth0 Post-Login Action. The bare `email` claim is not present in access tokens — it is only available in the id_token.

**Auth0 Action (already deployed)**:
```js
exports.onExecutePostLogin = async (event, api) => {
  api.accessToken.setCustomClaim('registered_user_email', event.user.email);
};
```

- [x] T025p [AUTH] Update `src/controllers/partyController.ts` — replace `req.auth?.payload?.email` with `req.auth?.payload?.['registered_user_email']`; update the TODO comment
- [x] T025q [P] [AUTH] Update `src/controllers/invitationController.ts` — replace `req.auth?.payload?.email` with `req.auth?.payload?.['registered_user_email']`; update the TODO comment

---

## Phase 4.9: Emailer Lambda — Invitation Link in Email

**Goal**: Include a fully-constructed, clickable invitation acceptance link in every invitation email sent by the emailer Lambda. The link is built from the `party_id` and `token` delivered by EventBridge (both sourced from the DynamoDB Invitations record) and a configurable base URL. The email body template placeholder is replaced with the real link at send time.

**Link format**: `{INVITATION_BASE_URL}/parties/{party_id}/invitations/{token}`
**Default base URL**: `https://127.0.0.1/api`

- [x] T025r [LAMBDA] Update `lambdas/emailer/src/types/emailerEvent.ts` — add optional `token?: string` field to `EmailerEvent`
- [x] T025s [LAMBDA] Update `lambdas/emailer/src/handler.ts` — read `INVITATION_BASE_URL` env var (default `https://127.0.0.1/api`); construct invitation link as `${baseUrl}/parties/${event.eventIdentifier}/invitations/${event.token}` when both are present (empty string fallback if either is missing); replace `<placeholder for link that directs to join the party with the party id>` in the email body with the constructed link
- [x] T025t [TERRAFORM] Add `invitation_base_url` variable to `terraform/modules/emailer-lambda/variables.tf` with default `https://127.0.0.1/api`
- [x] T025u [TERRAFORM] Add `INVITATION_BASE_URL = var.invitation_base_url` env var to the Lambda in `terraform/modules/emailer-lambda/main.tf`
- [x] T025v [TERRAFORM] Update `input_template` in `terraform/modules/emailer-lambda/eventbridge.tf` — add `"token": "<$.dynamodb.NewImage.token.S>"` field to the Pipe's input template so the token from the Invitations stream record is forwarded to the Lambda
- [x] T025w [P] [LAMBDA] Update `lambdas/emailer/tests/unit/test_handler.ts` — add `token: 'test-invite-token'` to `enrichedEvent` fixture; update the link placeholder assertion to verify the full URL `https://127.0.0.1/api/parties/party-abc/invitations/test-invite-token`; add test for missing token (link placeholder replaced with empty string)
- [x] T025x [TERRAFORM] `terraform apply` to deploy the EventBridge input template change and Lambda env var

---

## Phase 5.1: Cookie-Based Auth Migration (Constitution v1.13 Compliance)

**Goal**: Replace Bearer token auth with cookie-based JWT validation across all protected routes.
**Constitutional mandate**: Bearer tokens MUST NOT be accepted; `access_token` MUST be stored as
an `HttpOnly`/`Secure`/`SameSite=None` cookie after login and read from the cookie on each request.

- [X] T033a [AUTH] Update `src/auth/authRouter.ts` — in the OIDC callback, set the `access_token` as an `HttpOnly`, `Secure`, `SameSite=None` cookie (name: `access_token`) on the response before redirecting after successful login. Remove or repurpose `GET /api/auth/token` so it no longer returns the token in a JSON body.
- [X] T033b [AUTH] Update `src/auth/auth0.ts` — replace the `express-jwt` Bearer middleware with a cookie-reading JWT validation middleware. The middleware MUST extract the JWT from the `access_token` cookie and validate its signature (JWKS), audience, and issuer identically to the prior `express-jwt` setup. Remove the `express-jwt` and `jwks-rsa` Bearer configuration.
- [X] T033c [CONTROLLER] Update `src/controllers/index.ts` — replace `router.use(checkJwt)` with the new cookie-based JWT middleware from T033b. Confirm `registrationRouter` remains before the auth middleware (unauthenticated magic-link entry point).
- [X] T033d [CONTROLLER] Update `src/controllers/partyController.ts` — replace `(req as any).auth?.payload?.['registered_user_email']` with `req.oidc.user?.email` (OIDC session) or the equivalent claim from the validated cookie JWT payload.
- [X] T033e [CONTROLLER] Update `src/controllers/invitationController.ts` — same claim source migration as T033d.
- [X] T033f [P] [TEST] Update `tests/unit/test_auth_router.ts` — update or remove tests that cover `GET /api/auth/token` returning a JSON token body; add tests for the cookie-setting behaviour after the callback.
- [X] T033g [P] [TEST] Update any integration tests that mock or supply a Bearer JWT — replace with cookie-based auth mocking consistent with the new middleware.

---

## Phase 5.2: JWT Payload Claim Extraction (Constitution v1.14 Compliance)

**Goal**: Ensure all protected routes read user identity exclusively from the validated `access_token`
JWT payload rather than from the OIDC session.
**Constitutional mandate**: Email and all relevant user identity claims MUST be read from
`req.auth.payload['registered_user_email']` (Auth0 Post-Login Action custom claim). Using
`req.oidc.user` for identity extraction on protected routes is prohibited (constitution v1.14).

- [X] T034a [CONTROLLER] Update `src/controllers/partyController.ts` — revert the T033d change; read the admin email from `(req as any).auth?.payload?.['registered_user_email']` (the JWT payload custom claim set by the Auth0 Post-Login Action). Do not use `req.oidc.user?.email`.
- [X] T034b [CONTROLLER] Update `src/controllers/invitationController.ts` — same claim source correction as T034a.
- [X] T034c [P] [TEST] Update integration/contract tests that mock or assert the admin email claim — ensure they inject `registered_user_email` via the mocked `expressjwt` payload (`req.auth.payload`) rather than via `req.oidc.user`.

---

## Phase 5: User Story 3 - Invitation Acceptance & Registration (Priority: P2)

**Goal**: Allow invited users to register/sign in via Auth0 and join the party.
**Independent Test**: User can join a party using a valid invitation link and Auth0 authentication.

- [x] T026 [P] [US3] Contract test for GET /api/parties/{party_id}/invitations/{token} in tests/contract/test_accept_invite.ts
- [x] T027 [P] [US3] Integration test for invitation acceptance in tests/integration/test_accept_invite.ts
- [x] T028 [P] [US3] Implement PartyMember model in src/models/partyMember.ts
- [x] T029 [US3] Implement registration/acceptance service in src/services/registrationService.ts
- [x] T030 [US3] Implement GET /api/parties/{party_id}/invitations/{token} endpoint in src/controllers/registrationController.ts
- [x] T031 [US3] Add validation and error handling for registration
- [x] T032 [US3] Add logging for registration operations

---

## Phase 6: User Story 4 - Profile Completion & Gift Customization (Priority: P3)

**Goal**: Allow users to update missing profile fields and add gift details if enabled.
**Independent Test**: User can update blank profile fields and submit a gift blob if allowed.

- [X] T033 [P] [US4] Contract test for PUT /api/parties/{party_id}/members/{member_id}/profile in tests/contract/test_update_profile.ts
- [X] T034 [P] [US4] Contract test for POST /api/parties/{party_id}/members/{member_id}/gifts in tests/contract/test_gift_blob.ts
- [X] T035 [P] [US4] Integration test for profile/gift update in tests/integration/test_profile_gift.ts
- [X] T036 [P] [US4] Implement profile update service in src/services/profileService.ts
- [X] T037 [P] [US4] Implement gift blob service in src/services/giftService.ts
- [X] T038 [US4] Implement PUT /api/parties/{party_id}/members/{member_id}/profile endpoint in src/controllers/profileController.ts
- [X] T039 [US4] Implement POST /api/parties/{party_id}/members/{member_id}/gifts endpoint in src/controllers/giftController.ts
- [X] T040 [US4] Add validation and error handling for profile/gift
- [X] T041 [US4] Add logging for profile/gift operations

---

## Phase 6.1: Member Profile Retrieval & Self-Authorization (Constitution v1.15 Compliance)

**Goal**: Allow a party member to retrieve their own full profile (including the gift blob they
submitted). Codify and verify that all member-scoped mutation routes (`PUT /profile`,
`POST /gifts`) enforce the Member Self-Authorization principle from constitution v1.15 —
the authenticated user's email MUST match the `:member_id` URL parameter.

**Constitutional mandate**: Every `/api/parties/{party_id}/members/{member_id}/*` route MUST
compare `decodeURIComponent(member_id).toLowerCase()` against
`req.auth.payload['registered_user_email'].toLowerCase()` and return **403** on mismatch,
before any service call.

- [X] T041a [P] [US4] Contract test for GET /api/parties/{party_id}/members/{member_id}/profile in `tests/contract/test_get_profile.ts` — assert response shape `{email, party_id, role, joined_at}` with optional `first_name`, `last_name`, `gift_blob`
- [X] T041b [P] [US4] Integration test for GET profile and self-authorization enforcement in `tests/integration/test_profile_gift.ts` — add: GET profile success (mocked DynamoDB GetCommand), GET 404 when member not found, GET 403 when caller email ≠ member_id (controller-level), PUT 403 when caller email ≠ member_id, POST gifts 403 when caller email ≠ member_id
- [X] T041c [US4] Implement `getProfile(partyId, email)` in `src/services/profileService.ts` — single DynamoDB GetCommand; return the PartyMember record; throw 404 if not found
- [X] T041d [US4] Implement GET `/api/parties/:party_id/members/:member_id/profile` in `src/controllers/profileController.ts` — enforce Member Self-Authorization (403 on mismatch); call `getProfile`; return HTTP 200 with full PartyMember record
- [X] T041e [P] [US4] Verify Member Self-Authorization is enforced in `profileController.ts` (PUT) and `giftController.ts` (POST) — add targeted integration test assertions that a mismatched caller email produces HTTP 403 before the service is called

---

## Phase 7: User Story 5 - Party Locking & Assignment (Priority: P3)

**Goal**: Allow administrators to lock the party and assign users programmatically.
**Independent Test**: Party can be locked and assignments generated, with notifications sent.

- [X] T042 [P] [US5] Contract test for POST /api/parties/{party_id}/lock in tests/contract/test_lock_party.ts
- [X] T043 [P] [US5] Contract test for POST /api/parties/{party_id}/assignments in tests/contract/test_assignments.ts
- [X] T044 [P] [US5] Integration test for locking/assignment in tests/integration/test_lock_assign.ts
- [X] T045 [P] [US5] Implement assignment model in src/models/assignment.ts
- [X] T046 [US5] Implement party locking service in src/services/partyLockService.ts
- [X] T047 [US5] Implement assignment service in src/services/assignmentService.ts
- [X] T048 [US5] Implement POST /api/parties/{party_id}/lock endpoint in src/controllers/partyLockController.ts
- [X] T049 [US5] Implement POST /api/parties/{party_id}/assignments endpoint in src/controllers/assignmentController.ts
- [X] T050 [US5] Integrate AWS SNS for notifications in src/services/notificationService.ts
- [X] T051 [US5] Add validation and error handling for locking/assignment
- [X] T052 [US5] Add logging for locking/assignment operations

---

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T053 Review and update OpenAPI specs for all endpoints
- [x] T054 [P] Add/Update documentation in README.md and relevant docs/
- [x] T055 [P] Refactor code for maintainability and best practices
- [x] T056 [P] Finalize Terraform infrastructure and environment variables
- [ ] T057 [P] Conduct end-to-end testing and QA
- [ ] T058 [P] Prepare deployment scripts and CI/CD pipeline

---

## Dependencies

- Party creation (US1) must be completed before invitations (US2)
- Invitations (US2) must be completed before registration/acceptance (US3)
- Registration/acceptance (US3) must be completed before profile/gift updates (US4)
- Profile/gift updates (US4) must be completed before party locking/assignment (US5)

## Parallel Execution Examples

- Linting, formatting, and Terraform setup can run in parallel with project structure and dependency installation
- Contract and integration tests for each user story can be developed in parallel with implementation
- Logging, validation, and error handling tasks can be parallelized within each user story phase

## Implementation Strategy

- MVP: Complete all tasks for User Story 1 (Party Creation)
- Incremental delivery: Complete each user story phase in order, ensuring independent testability and deployment
