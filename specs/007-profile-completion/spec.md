# Feature Specification: Profile Completion

**Feature Branch**: `007-profile-completion`
**Created**: 2026-11-18
**Status**: Draft
**Input**: "Add the profile-completion feature": display first and last names instead of email addresses in the site header and party cards, and prompt users to save missing names after sign-in.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Complete my name after sign-in (Priority: P1)

As a signed-in user whose first or last name is missing, I want to enter and save my name so the site can greet me by name.

**Why this priority**: Without this flow, users with incomplete profiles cannot supply the names the site should display.

**Independent Test**: Sign in with an incomplete profile and no party memberships, save both names, and sign in again to verify they were retained.

**Acceptance Scenarios**:

1. **Given** a user has no saved names and no parties, **when** they sign in and their profile loads, **then** a dialog asks for First Name and Last Name and offers a **Save** button.
2. **Given** exactly one name is saved, **when** the dialog opens, **then** the existing name is prefilled and the missing field is empty.
3. **Given** either field is empty or contains only whitespace, **when** the user attempts to save, **then** the dialog remains open, identifies the missing field, and does not submit changes.
4. **Given** both fields contain valid names, **when** **Save** succeeds, **then** the dialog closes, the header shows the full name without a reload, and a later sign-in does not prompt again.
5. **Given** the save fails, **when** the request finishes, **then** the dialog stays open, preserves both inputs, and displays an error that allows the user to retry.
6. **Given** a different signed-in user, **when** they attempt to save names for another account, **then** the other account remains unchanged.

### User Story 2 - See names in the header and party cards (Priority: P2)

As a signed-in user, I want the header and party cards to show the relevant person's name so I can recognize myself and party hosts without relying on email addresses.

**Why this priority**: The completed profile is useful when the site uses it in place of email labels.

**Independent Test**: Sign in with a complete profile and view a joined-party card and a pending-invite card whose hosts have their own distinct names.

**Acceptance Scenarios**:

1. **Given** the signed-in user already has both names, **when** the dashboard loads, **then** the header shows the full name and no completion dialog opens, even if the user has no parties.
2. **Given** a joined-party or pending-invite card belongs to a host with both names saved, **when** the card renders, **then** its "Hosted By" label shows that host's full name, not the viewer's name or the host's email.
3. **Given** the host lacks a complete name, **when** the card renders, **then** its "Hosted By" label falls back to the host's email without prompting the viewer to complete the host's profile.

### Edge Cases

- A missing profile or a saved whitespace-only name triggers completion; a profile that could not be loaded is not treated as missing. On a load failure, show an error and offer a retry.
- While a save is in progress, further clicks on **Save** do not submit duplicate changes.
- Preserve capitalization, punctuation, and non-English characters; remove only surrounding whitespace.
- If existing party records disagree about a name, do not pick a value arbitrarily. Prefill only values that are unambiguous and prompt for the rest.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The site MUST load the signed-in user's saved names independently of party membership before deciding whether to show the completion dialog.
- **FR-002**: The site MUST show a completion dialog after sign-in when either name is absent or blank, with fields labeled **First Name** and **Last Name**, any already-known name prefilled, and a button labeled **Save**.
- **FR-003**: The site MUST require both names to be nonblank after trimming surrounding whitespace before accepting a save.
- **FR-004**: A save MUST persist both names for the signed-in user's own account only. The site MUST close the dialog only after the save succeeds and MUST NOT prompt again when both names are available on a later sign-in.
- **FR-005**: The site MUST preserve inputs and offer a retry after a save failure, prevent duplicate submissions while saving, and distinguish a failed profile load from an incomplete profile.
- **FR-006**: The header MUST display the signed-in user's full name once both names are available and update immediately after a successful save without a page reload.
- **FR-007**: Joined-party and pending-invite cards MUST show the host's full name in the "Hosted By" label when both names are available, and MUST use the host's email as the fallback otherwise.
- **FR-008**: Existing saved membership names MUST be reusable when unambiguous. For each missing account name, reuse the existing nonblank value only if all nonblank membership values agree after trimming; never replace a saved account name with a membership value.

### Key Entities

- **Account profile**: The signed-in person's first and last name, retained independently of party membership.
- **Party host**: The person identified by the "Hosted By" label on a joined-party or pending-invite card.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In all acceptance cases covering zero, one, or two missing names, the dialog appears only when a name is missing and correctly prefills any available name.
- **SC-002**: Every successful save in acceptance testing updates the header without a reload and prevents the prompt on the next sign-in; every failed save leaves the dialog open with the original input and a visible retry path.
- **SC-003**: In both card types, every test case with a complete host name displays that host's full name; every case with an incomplete host name displays the host's email.

## Assumptions

- Existing sign-in and email-based party, invitation, and notification behavior is unchanged; the feature changes the specified display labels, not account identifiers.
- This feature adds the completion dialog, not a separate profile editor for users who already have both names.
- Existing member and match displays are not redesigned by this feature.
