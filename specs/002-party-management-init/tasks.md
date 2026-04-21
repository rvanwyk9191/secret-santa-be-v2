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

## Phase 4: User Story 2 - Invitations (Priority: P2)

**Goal**: Allow administrators to invite participants by email and send invitation links.
**Independent Test**: Invited users receive an email with a valid party_id and token.

- [ ] T018 [P] [US2] Contract test for POST /api/parties/{party_id}/invitations in tests/contract/test_invite.ts
- [ ] T019 [P] [US2] Integration test for invitation flow in tests/integration/test_invitation.ts
- [ ] T020 [P] [US2] Implement Invitation model in src/models/invitation.ts
- [ ] T021 [US2] Implement invitation service in src/services/invitationService.ts
- [ ] T022 [US2] Implement POST /api/parties/{party_id}/invitations endpoint in src/controllers/invitationController.ts
- [ ] T023 [US2] Integrate AWS SNS for sending invitation emails in src/services/notificationService.ts
- [ ] T024 [US2] Add validation and error handling for invitations
- [ ] T025 [US2] Add logging for invitation operations

---

## Phase 5: User Story 3 - Invitation Acceptance & Registration (Priority: P2)

**Goal**: Allow invited users to register/sign in via Auth0 and join the party.
**Independent Test**: User can join a party using a valid invitation link and Auth0 authentication.

- [ ] T026 [P] [US3] Contract test for GET /api/parties/{party_id}/invitations/{token} in tests/contract/test_accept_invite.ts
- [ ] T027 [P] [US3] Integration test for invitation acceptance in tests/integration/test_accept_invite.ts
- [ ] T028 [P] [US3] Implement PartyMember model in src/models/partyMember.ts
- [ ] T029 [US3] Implement registration/acceptance service in src/services/registrationService.ts
- [ ] T030 [US3] Implement GET /api/parties/{party_id}/invitations/{token} endpoint in src/controllers/registrationController.ts
- [ ] T031 [US3] Add validation and error handling for registration
- [ ] T032 [US3] Add logging for registration operations

---

## Phase 6: User Story 4 - Profile Completion & Gift Customization (Priority: P3)

**Goal**: Allow users to update missing profile fields and add gift details if enabled.
**Independent Test**: User can update blank profile fields and submit a gift blob if allowed.

- [ ] T033 [P] [US4] Contract test for PUT /api/parties/{party_id}/members/{member_id}/profile in tests/contract/test_update_profile.ts
- [ ] T034 [P] [US4] Contract test for POST /api/parties/{party_id}/members/{member_id}/gifts in tests/contract/test_gift_blob.ts
- [ ] T035 [P] [US4] Integration test for profile/gift update in tests/integration/test_profile_gift.ts
- [ ] T036 [P] [US4] Implement profile update service in src/services/profileService.ts
- [ ] T037 [P] [US4] Implement gift blob service in src/services/giftService.ts
- [ ] T038 [US4] Implement PUT /api/parties/{party_id}/members/{member_id}/profile endpoint in src/controllers/profileController.ts
- [ ] T039 [US4] Implement POST /api/parties/{party_id}/members/{member_id}/gifts endpoint in src/controllers/giftController.ts
- [ ] T040 [US4] Add validation and error handling for profile/gift
- [ ] T041 [US4] Add logging for profile/gift operations

---

## Phase 7: User Story 5 - Party Locking & Assignment (Priority: P3)

**Goal**: Allow administrators to lock the party and assign users programmatically.
**Independent Test**: Party can be locked and assignments generated, with notifications sent.

- [ ] T042 [P] [US5] Contract test for POST /api/parties/{party_id}/lock in tests/contract/test_lock_party.ts
- [ ] T043 [P] [US5] Contract test for POST /api/parties/{party_id}/assignments in tests/contract/test_assignments.ts
- [ ] T044 [P] [US5] Integration test for locking/assignment in tests/integration/test_lock_assign.ts
- [ ] T045 [P] [US5] Implement assignment model in src/models/assignment.ts
- [ ] T046 [US5] Implement party locking service in src/services/partyLockService.ts
- [ ] T047 [US5] Implement assignment service in src/services/assignmentService.ts
- [ ] T048 [US5] Implement POST /api/parties/{party_id}/lock endpoint in src/controllers/partyLockController.ts
- [ ] T049 [US5] Implement POST /api/parties/{party_id}/assignments endpoint in src/controllers/assignmentController.ts
- [ ] T050 [US5] Integrate AWS SNS for notifications in src/services/notificationService.ts
- [ ] T051 [US5] Add validation and error handling for locking/assignment
- [ ] T052 [US5] Add logging for locking/assignment operations

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T053 Review and update OpenAPI specs for all endpoints
- [ ] T054 [P] Add/Update documentation in README.md and relevant docs/
- [ ] T055 [P] Refactor code for maintainability and best practices
- [ ] T056 [P] Finalize Terraform infrastructure and environment variables
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
