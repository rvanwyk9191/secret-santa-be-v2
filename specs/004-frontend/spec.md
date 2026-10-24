# Secret Santa v2 — Frontend

## Overview

Build a React + TypeScript single-page application for the Secret Santa v2 platform. The frontend runs on port **3000** and communicates with the backend API running on port **8080**. All UI components use **Material UI (MUI)** for styling. HTTP calls use **Axios**. All components are functional (no class components).

---

## Goals

- Provide a landing page that gates access behind Auth0 login.
- Give authenticated users a single dashboard to manage all parties they belong to and all parties they host.
- Allow party hosts to create parties, invite members, lock/unlock the party, auto-assign matches, enable/disable gift customization, and email members their matches.
- Allow party members to view their match and submit a gift wish-list.
- **After any data-mutating action, components MUST trigger a silent background refresh of all dashboard data so the UI reflects server state without a visible loading spinner.**
- Achieve ≥ 80% test coverage per component. Focus on happy paths and key error states; do not over-specify edge cases.

---

## Data refresh contract

`MainPage` owns all server state and exposes a `fetchData(silent?: boolean)` function:
- `silent = false` (default, initial load): sets `loading = true`, shows a full-page spinner.
- `silent = true` (post-action refresh): updates state in the background without showing a loading spinner.

Every component that mutates server data MUST call `onRefresh()` (which maps to `fetchData(true)`) on success. Components read data from props derived from `MainPage` state and MUST NOT hold stale local copies of server data.

---

## Tech stack

| Concern | Choice |
|---|---|
| Framework | React 18 + TypeScript |
| UI library | Material UI (MUI) v5 |
| HTTP client | Axios |
| Test framework | Jest + React Testing Library |
| Port | 3000 |
| Backend base URL | `http://localhost:8080/api` |
| Auth | Auth0 via backend OIDC redirect (`/api/auth/login`, `/api/auth/logout`) |

---

## Actors

- **Authenticated member**: a user who has logged in and accepted an invitation to at least one party.
- **Party host (admin)**: an authenticated user who created one or more parties.

---

## Component inventory

| Component | File | Route / trigger |
|---|---|---|
| `Landing` | `pages/Landing.tsx` | `/` (unauthenticated) |
| `MainPage` | `pages/MainPage.tsx` | `/` (authenticated) |
| `PendingInviteCard` | `components/PendingInviteCard.tsx` | Rendered inside MainPage "Pending Invites" section |
| `PartyMemberCard` | `components/PartyMemberCard.tsx` | Rendered inside MainPage "Parties You Are Part Of" |
| `HostedPartyPanel` | `components/HostedPartyPanel.tsx` | Rendered inside MainPage "Parties You Host" |
| `MemberRow` | `components/MemberRow.tsx` | Rendered inside HostedPartyPanel |
| `CreateAParty` | `components/modals/CreateAParty.tsx` | Modal opened from "Create A Party" button |
| `EnterGifts` | `components/modals/EnterGifts.tsx` | Modal opened from "Edit Gifts" button |
| `InviteMembers` | `components/modals/InviteMembers.tsx` | Modal opened from "Invite Members" button |
| `SeeMatch` | `components/modals/SeeMatch.tsx` | Modal opened from "See Match" button |

---

## User stories

### US0 — Pending Invites

As an authenticated user who has been invited to one or more parties, I see a **"Pending Invites"** section at the top of the main dashboard, above "Parties You Are Part Of". The section is only rendered when there is at least one pending invitation.

Each pending invitation is displayed as a card (`PendingInviteCard`) matching the same `Card variant="outlined"` styling as `PartyMemberCard`. The card shows:
- Party name (bold subtitle)
- **"Hosted By:"** followed by the admin's email
- **"Date:"** followed by the formatted party date (omitted if no date is set)
- A **"Deny"** button (outlined, error colour) and an **"Accept"** button (contained, inherit colour)

**Acceptance criteria:**
- The "Pending Invites" section header and cards are visible only when `GET /api/me/pending-invites` returns at least one item.
- "Accept" calls `POST /api/parties/{party_id}/invitations/{token}/accept`; on success the page data refreshes (invite disappears, accepted party appears in "Parties You Are Part Of").
- "Deny" calls `POST /api/parties/{party_id}/invitations/{token}/decline`; on success the invite card disappears.
- Inline error text is shown within the card if accept or deny fails.
- Both buttons are disabled while the action is in-flight.

---

### US1 — Landing page

As an unauthenticated visitor, I see a simple page with the title **"Secret Santa"** and a **"Log In"** button. Clicking "Log In" redirects my browser to `GET /api/auth/login` (the Auth0 OIDC flow). After successful login the backend redirects me to `/`.

**Acceptance criteria:**
- Title "Secret Santa" is visible on the page.
- A single "Log In" button is present.
- Clicking "Log In" navigates to `/api/auth/login` (full page navigation, not an Axios call).
- No other interactive elements are present.

---

### US2 — Main dashboard

As an authenticated user, I see:

**Top bar:**
- Greeting: `Ho, Ho, Ho...{firstName} {lastName}` (or email if name is not yet set).
- **"Sign Out"** button (top-right). Clicking it navigates to `GET /api/auth/logout`.

**"Parties You Are Part Of" section:**
- Header: `Parties You Are Part Of`.
- Displays one `PartyMemberCard` per party the user is a member of (but not admin of). Three cards per row maximum; extras wrap to a new row.
- If the user is not a member of any parties, show a placeholder message: `"You haven't joined any parties yet."`.

**"Parties You Host" section:**
- Header: `Parties You Host` with a **"Create A Party"** button inline.
- Displays one `HostedPartyPanel` per party the user is the admin of.
- If the user hosts no parties, show a placeholder: `"You haven't created any parties yet."`.

**Acceptance criteria:**
- Page fetches both member-parties and hosted-parties on mount.
- A loading indicator is shown while data is being fetched.
- An error message is shown if either fetch fails.

---

### US3 — Party member card (`PartyMemberCard`)

Each card in "Parties You Are Part Of" shows:
- Party name.
- `Hosted By: {adminFirstName} {adminLastName}` (or admin email if name unknown).
- **"See Match"** button — visible **only** when the party is assigned (i.e. an assignment exists for the current user). Opens the `SeeMatch` modal.
- **"Edit Gifts"** button — visible **only** when the party is **not locked** and the party has `customizationEnabled: true`. Opens the `EnterGifts` modal.

---

### US4 — See match modal (`SeeMatch`)

Opens when the user clicks "See Match" on a `PartyMemberCard`.

- Header text: `See Match`.
- Title: `Matched With: {recipientFirstName} {recipientLastName}` (or recipient email if name unknown).
- Displays the recipient's gift wish-list as **read-only** MUI `TextField` components, labelled `Gift #1`, `Gift #2`, etc. (one per gift item parsed from `gift_blob`).
- A **"Close"** button closes the modal.

---

### US5 — Enter gifts modal (`EnterGifts`)

Opens when the user clicks "Edit Gifts" on a `PartyMemberCard`.

- Header: `Edit Gifts`.
- Title: `Enter Your Gifts`.
- Dynamic list of MUI `TextField` inputs labelled `Gift #1`, `Gift #2`, etc. Starts with one field; pre-populated with any existing `gift_blob` on open.
- **"Add"** button appends a new empty field.
- **"Remove"** button on each row removes that entry (minimum one row remains).
- **"Cancel"** closes the modal without saving.
- **"Save"** (not "Create") calls `POST /api/parties/{party_id}/members/{member_id}/gifts` with the joined gift list as `giftBlob`, then closes the modal.

---

### US6 — Hosted party panel (`HostedPartyPanel`)

Each panel in "Parties You Host" shows:

**Header line:** `{partyName} {partyDate}` (date formatted as `MM/DD/YYYY`).

**Action buttons (in order):**

| Button | Condition | Action |
|---|---|---|
| **"Lock the Party"** | Party is **not** locked | Calls `POST /api/parties/{party_id}/lock` |
| **"Unlock the Party"** | Party **is** locked | Calls `POST /api/parties/{party_id}/unlock` *(see §Required new backend endpoints)* |
| **"Auto-Assign"** | No assignments exist yet | Calls `POST /api/parties/{party_id}/assignments` `{ mode: 'automatic' }` |
| **"Re-Assign"** | Assignments already exist | Same call as Auto-Assign |
| **"Email Members"** | Always present | Calls `POST /api/parties/{party_id}/email-matches` *(see §Required new backend endpoints)*; **disabled** when party is not locked or not assigned |
| **"Invite Members"** | Always present | Opens `InviteMembers` modal |
| **"Enable Custom"** | `customizationEnabled` is **false** | Calls `PATCH /api/parties/{party_id}` `{ customizationEnabled: true }` *(see §Required new backend endpoints)* |
| **"Disable Custom"** | `customizationEnabled` is **true** | Calls `PATCH /api/parties/{party_id}` `{ customizationEnabled: false }` |

**Member list:**

All accepted members are listed in a grid (3 per row, wrapping). Each `MemberRow` shows:

- Member display name (first + last name, or email fallback).
- **"Remove"** button — calls `DELETE /api/parties/{party_id}/members/{member_id}` *(see §Required new backend endpoints)*.
- **"Peek"** button — toggles the member's display to append `– Match is {recipientName}` when activated; **"Hide"** when the peek is visible (as shown in the design). Only available when assignments exist.
- **"Email Match"** button — calls `POST /api/parties/{party_id}/members/{member_id}/email-match` *(see §Required new backend endpoints)*.

---

### US7 — Create a party modal (`CreateAParty`)

Opens when the user clicks "Create A Party".

- Header: `Create A Party`.
- Title: `Enter Party Details`.
- **"Buy your gifts by"** — MUI `DatePicker` (required).
- **"Party Name"** — MUI `TextField` (required).
- **"Short Party Description"** — MUI `TextField` (optional).
- Dynamic list of `Secret Santa #N` email `TextField` inputs. Starts with one. Add / Remove behave the same as `EnterGifts`.
- **"Cancel"** closes the modal.
- **"Create"** button:
  1. Validates "Buy your gifts by" and "Party Name" are filled (shows inline error if not).
  2. Calls `POST /api/parties` with `{ name, description, customizationEnabled: false }`.
  3. For each email in the list, calls `POST /api/parties/{party_id}/invitations`.
  4. Closes the modal and refreshes the "Parties You Host" list.

---

### US8 — Invite members modal (`InviteMembers`)

Same layout and behaviour as `EnterGifts` but for inviting members:

- Header: `Invite Members`.
- Title: `Invite Members to the Party`.
- Dynamic list of email `TextField` inputs labelled `Secret Santa #N`.
- **"Add"** / **"Remove"** same as CreateAParty.
- **"Cancel"** closes the modal.
- **"Invite"** calls `POST /api/parties/{party_id}/invitations` once per email, then closes.

---

## Required new backend endpoints

The frontend requires the following endpoints that do not yet exist in the backend. These must be added to the backend before this feature is complete.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/me/parties` | Returns all parties where the authenticated user is a **member** (accepted invitation), including their profile and assignment for each party. |
| `GET` | `/api/me/hosted-parties` | Returns all parties where the authenticated user is the **admin**, with full member lists and assignment status. |
| `POST` | `/api/parties/{party_id}/unlock` | Unlocks a previously locked party. Admin only. |
| `PATCH` | `/api/parties/{party_id}` | Updates `customizationEnabled` (and potentially other mutable fields). Admin only. |
| `DELETE` | `/api/parties/{party_id}/members/{member_id}` | Removes an accepted member from the party. Admin only. |
| `POST` | `/api/parties/{party_id}/email-matches` | Triggers the emailer Lambda to send each member their match assignment. Party must be locked and assigned. Admin only. |
| `POST` | `/api/parties/{party_id}/members/{member_id}/email-match` | Sends the match email to a single member. Admin only. |

---

## API response shapes expected by the frontend

### `GET /api/me/parties`
```typescript
Array<{
  party: Party;                      // { party_id, name, description?, admin_email, customizationEnabled, locked, created_at, updated_at }
  member: PartyMember;               // { email, party_id, role, first_name?, last_name?, joined_at, gift_blob? }
  assignment?: {                     // present only when assigned
    recipient_email: string;
    recipient_first_name?: string;
    recipient_last_name?: string;
    recipient_gift_blob?: string;
  };
}>
```

### `GET /api/me/hosted-parties`
```typescript
Array<{
  party: Party;
  members: Array<{
    member: PartyMember;
    assignment?: { recipient_email: string; recipient_first_name?: string; recipient_last_name?: string };
  }>;
  assigned: boolean;                // true if all members have an assignment
}>
```

---

## Test requirements

- Every component must have a co-located `*.test.tsx` file.
- Minimum **80% statement and branch coverage** per component.
- Cover:
  - Render without props / with minimal required props.
  - Happy-path user interactions (click, type, submit).
  - Loading and error states where applicable.
  - Modal open / close lifecycle.
- Do **not** write tests for every possible validation edge case.
- Mock Axios calls using `jest.mock('axios')` or `axios-mock-adapter`.
- Do not test MUI internals.

---

## Project structure

```
frontend/
├── src/
│   ├── api/
│   │   └── client.ts             # Axios instance configured with baseURL http://localhost:8080/api
│   ├── pages/
│   │   ├── Landing.tsx
│   │   ├── Landing.test.tsx
│   │   ├── MainPage.tsx
│   │   └── MainPage.test.tsx
│   ├── components/
│   │   ├── PartyMemberCard.tsx
│   │   ├── PartyMemberCard.test.tsx
│   │   ├── HostedPartyPanel.tsx
│   │   ├── HostedPartyPanel.test.tsx
│   │   ├── MemberRow.tsx
│   │   ├── MemberRow.test.tsx
│   │   └── modals/
│   │       ├── CreateAParty.tsx
│   │       ├── CreateAParty.test.tsx
│   │       ├── EnterGifts.tsx
│   │       ├── EnterGifts.test.tsx
│   │       ├── InviteMembers.tsx
│   │       ├── InviteMembers.test.tsx
│   │       ├── SeeMatch.tsx
│   │       └── SeeMatch.test.tsx
│   ├── types/
│   │   └── api.ts                # TypeScript interfaces for all API shapes
│   ├── App.tsx                   # Router: / → Landing or MainPage based on auth state
│   └── main.tsx                  # React entry point, renders <App />
├── package.json
├── tsconfig.json
└── vite.config.ts                # Vite dev server on port 3000, proxy /api → localhost:8080
```

---

## Auth state detection

The app determines whether the user is authenticated by calling `GET /api/me/parties` on mount. A `401` response means unauthenticated → render `Landing`. A successful response means authenticated → render `MainPage`.

---

## Routing

Use React Router v6. Two routes:
- `/` — renders `Landing` (if unauthenticated) or `MainPage` (if authenticated).
- All other paths redirect to `/`.

Authentication check is performed in `App.tsx` before route resolution.
