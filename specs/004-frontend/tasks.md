# Tasks: Secret Santa v2 — Frontend

**Input**: Design documents from `/specs/004-frontend/`
**Prerequisites**: spec.md (required for user stories and component inventory)

---

## Phase 1: Project Setup

- [x] T001 Scaffold React + TypeScript project in `frontend/` using Vite (`npm create vite@latest`)
- [x] T002 Install dependencies: `react`, `react-dom`, `react-router-dom`, `@mui/material`, `@mui/x-date-pickers`, `@emotion/react`, `@emotion/styled`, `axios`
- [x] T003 Install dev dependencies: `jest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `axios-mock-adapter`, `@types/react`, `@types/react-dom`, `ts-jest`
- [x] T004 Configure Vite dev server on port 3000 with `/api` proxy to `http://localhost:8080`
- [x] T005 Configure Jest with `jsdom` test environment and coverage threshold ≥ 80%
- [x] T006 Configure ESLint + Prettier

---

## Phase 2: Foundational — Types, API Client, Routing

- [x] T007 Create `frontend/src/types/api.ts` — TypeScript interfaces for `Party`, `PartyMember`, `Assignment`, `PendingInvite`, and all API response shapes defined in spec.md
- [x] T008 Create `frontend/src/api/client.ts` — Axios instance with `baseURL: 'http://localhost:8080/api'` and `withCredentials: true`
- [x] T009 Create `frontend/src/api/partyApi.ts` — typed wrappers for all backend API calls used by the frontend (GET /api/me/parties, GET /api/me/hosted-parties, GET /api/me/pending-invites, POST /api/parties/:id/invitations/:token/accept, POST /api/parties/:id/invitations/:token/decline, POST /api/parties, POST /api/parties/:id/invitations, POST /api/parties/:id/lock, POST /api/parties/:id/unlock, PATCH /api/parties/:id, DELETE /api/parties/:id, POST /api/parties/:id/assignments, DELETE /api/parties/:id/members/:member_id, POST /api/parties/:id/email-matches, POST /api/parties/:id/members/:member_id/email-match, POST /api/parties/:id/members/:member_id/gifts)
- [x] T010 Create `frontend/src/App.tsx` — checks auth state via GET /api/me/parties on mount; renders `Landing` on 401, `MainPage` on success; shows loading spinner during the check
- [x] T011 Set up React Router v6 in `frontend/src/main.tsx` — single route `/` → `App`

---

## Phase 2b: US0 — Pending Invites

**Goal**: Authenticated users with pending invitations see a "Pending Invites" section at the top of the main dashboard.

**Backend:**
- [x] T012b [BACKEND] Add `'declined'` to `InvitationStatus` union in `backend/src/models/invitation.ts`
- [x] T013b [BACKEND] Create `backend/src/controllers/pendingInvitesController.ts` — `GET /api/me/pending-invites` (scan Invitations by caller email + status='pending', enrich with Party details); `POST /api/parties/:party_id/invitations/:token/accept` (JWT-authenticated accept); `POST /api/parties/:party_id/invitations/:token/decline` (marks invitation as 'declined')
- [x] T014b [BACKEND] Register `pendingInvitesRouter` in `backend/src/controllers/index.ts` behind `checkJwt`

**Frontend:**
- [x] T015b [FRONTEND] Add `PendingInvite` interface to `frontend/src/types/api.ts`
- [x] T016b [FRONTEND] Add `getMyPendingInvites`, `acceptPendingInvite`, `declinePendingInvite` to `frontend/src/api/partyApi.ts`
- [x] T017b [FRONTEND] Create `frontend/src/components/PendingInviteCard.tsx` — `Card variant="outlined"` showing party name, host, date, "Deny" (outlined error) and "Accept" (contained inherit) buttons; inline error on failure; buttons disabled during in-flight requests
- [x] T018b [FRONTEND] Update `frontend/src/pages/MainPage.tsx` — fetch `getMyPendingInvites` alongside existing fetches; render the "Pending Invites" section with `PendingInviteCard` grid above "Parties You Are Part Of" when pending list is non-empty

---

## Phase 2c: Post-action silent refresh

**Goal**: Every data-mutating action triggers a silent background re-fetch so the UI always reflects server state without a full-page loading spinner.

- [x] T019b [FRONTEND] Update `MainPage.fetchData` to accept `silent?: boolean`; when `true`, skip setting `loading = true` and suppress error state changes — pass `() => fetchData(true)` as `onRefresh` to all child components
- [x] T020b [FRONTEND] Refactor `HostedPartyPanel` — remove `localParty`/`localAssigned` local state; read `party` and `assigned` directly from `entry` prop; replace `setLocalParty`/`setLocalAssigned` calls with `onRefresh()` so server data is always authoritative
- [x] T021b [FRONTEND] Add optional `onRefresh?: () => void` prop to `PartyMemberCard`; call `onRefresh?.()` when `EnterGifts` modal closes so gift changes are reflected in the parent
- [x] T022b [FRONTEND] All other `onRefresh` call-sites in `PendingInviteCard` and `MemberRow.onRemoved` already call the parent refresh — verified consistent with the contract

---

## Phase 3: US1 — Landing Page

**Goal**: Unauthenticated visitors see "Secret Santa" and a Log In button.

- [x] T012 [US1] Implement `frontend/src/pages/Landing.tsx` — MUI `Box` centered layout, `Typography` heading "Secret Santa", MUI `Button` "Log In" that does `window.location.href = '/api/auth/login'`
- [x] T013 [P] [US1] Write `frontend/src/pages/Landing.test.tsx` — renders heading and button; clicking "Log In" sets `window.location.href`

---

## Phase 4: US2 — Main Page Shell

**Goal**: Authenticated users see a top bar with greeting + Sign Out, and two section headers.

- [x] T014 [US2] Implement `frontend/src/pages/MainPage.tsx` shell — MUI `AppBar` with `Ho, Ho, Ho...{name}` greeting and "Sign Out" button; two section headers ("Parties You Are Part Of", "Parties You Host" with "Create A Party" button inline); loading spinner and error state while fetching
- [x] T015 [US2] Wire `GET /api/me/parties` and `GET /api/me/hosted-parties` fetch on mount in `MainPage`; pass data down to child components
- [x] T016 [P] [US2] Write `frontend/src/pages/MainPage.test.tsx` — renders loading state; renders both section headers after fetch resolves; shows placeholder text when each list is empty; shows error message on fetch failure; "Sign Out" navigates to `/api/auth/logout`

---

## Phase 5: US3 — PartyMemberCard

**Goal**: Member cards show party name, host name, and conditional See Match / Edit Gifts buttons.

- [x] T017 [US3] Implement `frontend/src/components/PartyMemberCard.tsx` — MUI `Card` with party name, "Hosted By: {name}", conditional "See Match" button (when `assignment` present), conditional "Edit Gifts" button (when `!party.locked && party.customizationEnabled`)
- [x] T018 [P] [US3] Write `frontend/src/components/PartyMemberCard.test.tsx` — renders party name and host; "See Match" absent when no assignment, present when assignment present; "Edit Gifts" absent when locked or customization disabled, present otherwise

---

## Phase 6: US4 — SeeMatch Modal

**Goal**: Read-only view of the matched recipient's gift list.

- [x] T019 [US4] Implement `frontend/src/components/modals/SeeMatch.tsx`
- [x] T020 [P] [US4] Write `frontend/src/components/modals/SeeMatch.test.tsx`

---

## Phase 7: US5 — EnterGifts Modal

**Goal**: Members submit or update their gift wish-list.

- [x] T021 [US5] Implement `frontend/src/components/modals/EnterGifts.tsx`
- [x] T022 [P] [US5] Write `frontend/src/components/modals/EnterGifts.test.tsx`

---

## Phase 8: US8 — InviteMembers Modal

**Goal**: Admin invites new members by email from within an existing party.

- [x] T023 [US8] Implement `frontend/src/components/modals/InviteMembers.tsx`
- [x] T024 [P] [US8] Write `frontend/src/components/modals/InviteMembers.test.tsx`

---

## Phase 9: US7 — CreateAParty Modal

**Goal**: Admin creates a new party and sends initial invitations in one flow.

- [x] T025 [US7] Implement `frontend/src/components/modals/CreateAParty.tsx`
- [x] T026 [P] [US7] Write `frontend/src/components/modals/CreateAParty.test.tsx`

---

## Phase 10: US6 — MemberRow

**Goal**: Per-member controls within a hosted party panel.

- [x] T027 [US6] Implement `frontend/src/components/MemberRow.tsx`
- [x] T028 [P] [US6] Write `frontend/src/components/MemberRow.test.tsx`

---

## Phase 11: US6 — HostedPartyPanel

**Goal**: Full admin control panel for a single hosted party.

- [x] T029 [US6] Implement `frontend/src/components/HostedPartyPanel.tsx`
- [x] T030 [P] [US6] Write `frontend/src/components/HostedPartyPanel.test.tsx`

---

## Phase 12: Integration — Wire MainPage

**Goal**: Connect all child components into the MainPage and verify full page renders.

- [x] T031 Render `PartyMemberCard` list inside "Parties You Are Part Of" section in `MainPage`; show placeholder when list empty
- [x] T032 Render `HostedPartyPanel` list inside "Parties You Host" section; wire `CreateAParty` modal open/close and refresh list on creation
- [x] T033 [P] Update `MainPage.test.tsx` — full render with mocked API returning member parties and hosted parties; cards and panels render; Create A Party modal opens and closes

---

## Phase 13: Polish & Cross-Cutting

- [x] T034 [P] Ensure all components handle API error states
- [x] T035 [P] Add loading spinners / disabled states to all buttons during in-flight API calls
- [x] T036 Review all components against figma screens for visual alignment
- [x] T037 Run coverage report; ensure all components meet ≥ 80% threshold; add targeted tests for any gaps
- [x] T038 [P] Update `specs/004-frontend/spec.md` if any implementation decisions deviate from the spec

---

## Phase 14: New Backend Endpoints

These backend tasks are **blocking** for Phase 12 and must be completed before the full frontend integration can be tested end-to-end.

- [x] T039 [BE] Implement `GET /api/me/parties`
- [x] T040 [BE] Implement `GET /api/me/hosted-parties`
- [x] T041 [BE] Implement `POST /api/parties/:party_id/unlock`
- [x] T042 [BE] Implement `PATCH /api/parties/:party_id`
- [x] T043 [BE] Implement `DELETE /api/parties/:party_id/members/:member_id`
- [x] T044 [BE] Implement `POST /api/parties/:party_id/email-matches`
- [x] T045 [BE] Implement `POST /api/parties/:party_id/members/:member_id/email-match`
- [ ] T046 [BE] Add unit + contract tests for all 7 new backend endpoints
- [x] T047 [BE] Update `docs/openapi.yaml` with all 7 new endpoint definitions

---

## Dependencies

- Phase 3 (Landing) is independent and can be built first.
- Phases 5–11 (components) can be built in parallel once Phase 2 foundational work is done.
- Phase 12 (integration) requires Phases 4–11 to be complete.
- Phase 14 (backend) must be complete before end-to-end testing in Phase 12.
- T037 (coverage) must run after all components are implemented.
