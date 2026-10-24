# Party Management, Auth0 Registration, and SNS Notification

## Overview

Build a party-based gift exchange application where users create and manage parties, invite participants by email, and coordinate assignments with Auth0-based authentication. Each party receives a unique `party_id`. The party creator becomes the administrator, and their Auth0 email is recorded as the party admin email.

## Goals

- Allow authenticated users to create parties and become party administrators.
- Enable administrators to invite additional participants by email.
- Let invited users register or sign in through Auth0 / Google, associating their email with the correct party via `party_id` in the invitation link.
- Support adding customizable gift details as a blob text field when the party allows customization.
- Allow users to complete missing profile data (first name, last name) during registration or later.
- Allow administrators to lock parties and programmatically assign each user a recipient.
- Use an event-driven email architecture: invitation emails are triggered automatically by a DynamoDB Stream on the Invitations table via EventBridge Pipes + Lambda, not published directly by the web app.
- Align the feature with domain-driven service separation, DynamoDB-backed data stores, and AWS deployment best practices.

## Architecture alignment

- The party management flows should fit within the existing `user`, `admin`, and `authentication` domains.
- Each domain should remain independently deployable behind the ALB via its own ECS task and route.
- New APIs should be captured in a domain-specific OpenAPI spec to support testing and contract validation.

## Actors

- Party Administrator: creates a party, invites members, locks the party, and triggers assignments.
- Invited Participant: receives an invitation, authenticates through Auth0, and joins the party.
- Auth0 / Google Authenticator: provides authentication and verified email identity.
- Email Notification System (EventBridge Pipes + Emailer Lambda): delivers invitation emails triggered by DynamoDB Streams, not by the web app directly.

## Key Concepts

- `party_id`: unique identifier for a party.
- Party administrator: the creator of a party, identified by Auth0 email.
- Invitation: an email-based invite containing `party_id` and an invitation token.
- Party member: a user associated with a party and identified by Auth0 email.
- Gift blob: a free-form string payload provided by the front-end when customization is enabled.
- Customization flag: a party-level setting that controls whether members can submit gift details.
- Lock state: when the party is locked, membership changes and gift additions may become restricted.
- Assignment: mapping from each participant to another user they should buy a gift for.

## Requirements

### Party creation

- Authenticated user creates a party.
- System generates a new `party_id`.
- Creator becomes party administrator.
- Creator's Auth0 email is stored as the party admin email.
- Party metadata includes `name`, optional `description`, `customizationEnabled`, `locked`, and timestamps.

### Invitations

- Administrator can send invites to other people by email.
- Each invitation is associated with `party_id` and has a secure token.
- Creating an invitation persists the record to DynamoDB with `status: 'pending'`. The web app does not publish SNS notifications or send emails directly.
- Invitation email delivery is handled automatically by the event-driven emailer Lambda triggered via DynamoDB Streams and EventBridge Pipes.
- Links in invitation emails contain the `party_id` and token.
- Clicking the link lands on `GET /api/parties/:party_id/invitations/:token`. This endpoint does not require a Bearer token — authentication is handled via the OIDC session cookie:
  - **Unauthenticated visitor**: the server immediately redirects the browser to the Auth0 Universal Login page (register or sign in). The original invitation URL is stored as `returnTo` so Auth0 redirects back to this endpoint after authentication completes.
  - **Authenticated visitor** (returned via `returnTo` after login, or already logged in): the server reads the user email from the OIDC session cookie, accepts the invitation, and redirects the browser to the application root (`/`).
- After Auth0 success, the system associates the user email with the party if the token and party are valid.

### Auth0 registration and email association

- The application uses Auth0 for all sign in / sign up flows.
- Google login is supported through Auth0.
- The authenticated user's email becomes the identity key for party association.
- If there is an existing invitation for that email and party, connect the user to the party.
- If the user has already been invited and signs in with the same email, they join the party automatically.

### Profile completion

- After authentication, members can update profile fields if blank:
  - first name
  - last name
- These profile fields must be stored and available for party administration and assignment display.
- Members can retrieve their own profile at any time. The response includes:
  - `email`, `party_id`, `role`, `first_name?`, `last_name?`, `joined_at`, `gift_blob?`
  - This provides the member with a view of their complete profile including any gift list they have submitted.

### Member self-authorization

- A party member MUST only be able to read or modify their own profile and gift data.
- On all `/api/parties/{party_id}/members/{member_id}/*` routes, the server MUST verify that
  the decoded `:member_id` URL parameter matches the authenticated user's
  `registered_user_email` JWT claim (both compared lowercase).
- If the values do not match, the server MUST respond with **HTTP 403 Forbidden** before any
  service call is made.
- This rule applies to `GET /profile`, `PUT /profile`, and `POST /gifts`.

### Gift customization

- Parties can enable gift customization through a party-level flag.
- If `customizationEnabled` is true, members can submit gift details as a blob field.
- The front-end will pass gift data as a string field, e.g. `gift_blob`.
- If customization is disabled, gift details cannot be submitted or updated.

### Party locking and assignment

- The administrator can lock the party when membership and gift entry are complete.
- Once locked, the party prevents further invitations or gift changes based on business rules.
- Administrator can trigger programmatic assignment of participants to recipients.
- Assignment should ensure each participant is assigned one recipient and a participant is assigned one giver.
- The assignment process can be automatic (random, valid cycle) or explicit via admin-supplied mapping.

### Email notifications (event-driven)

- Invitation emails are sent automatically by the emailer Lambda, triggered by DynamoDB Streams when a new `pending` Invitation record is inserted.
- The web app is NOT responsible for sending emails or publishing SNS notifications as part of the invitation flow.
- Other notification types (invitation accepted, party locked, assignments completed) may be handled by future event-driven handlers on the same pattern.

## Data Model

### Party

DynamoDB table: `Parties`
- PK: `party_id`
- Attributes:
  - `name`
  - `description?`
  - `admin_email`
  - `customization_enabled`
  - `locked`
  - `created_at`
  - `updated_at`

### PartyMember

DynamoDB table: `PartyMembers`
- PK: `email`
- SK: `party_id`
- Attributes:
  - `auth0_user_id`
  - `role: enum('admin','member')`
  - `first_name?`
  - `last_name?`
  - `joined_at`
  - `gift_blob?`

This allows queries by user email across parties and fast lookups when the front-end has both `email` and `party_id`.

### Invitation

DynamoDB table: `Invitations`
- PK: `party_id`
- SK: `email`
- Attributes:
  - `token`
  - `status: enum('pending','accepted','revoked')`
  - `sent_at`
  - `accepted_at?`

Since invitations are looked up by `party_id` and `email`, the `invitation_id` field is unnecessary. Use the combination of `party_id` + `email` to locate invitations and validate tokens.

### Assignment

DynamoDB table: `Assignments`
- PK: `party_id`
- SK: `giver_member_id`
- Attributes:
  - `receiver_member_id`
  - `created_at`

This supports querying all assignments for a party and locating a giver's assigned receiver.

### NotificationEvent

DynamoDB table: `NotificationEvents`
- PK: `party_id`
- SK: `created_at` (or `event_id` if stable ordering is required)
- Attributes:
  - `type: enum('invitation_sent','invitation_accepted','party_locked','assignment_completed','gift_updated')`
  - `payload: object`

This supports querying notification history by party.

## API / Workflow

### Create party

- POST `/api/parties`
- Request body: `{name, description?, customizationEnabled}`
- Response: `{party_id, admin_email, customizationEnabled, locked}`

### Invite participant

- POST `/api/parties/{party_id}/invitations`
- Request body: `{email}`
- Behavior: create invitation token, persist invite record to DynamoDB with `status: 'pending'`. Email delivery is handled automatically by the event-driven emailer Lambda.
- Response: `{party_id, email, token}`

### Accept invitation

- GET `/api/parties/{party_id}/invitations/{token}`
- Behavior: verify link, redirect through Auth0 login, then associate email with party.

### Get member profile

- GET `/api/parties/{party_id}/members/{member_id}/profile`
- Authorization: authenticated member whose email matches `:member_id`.
- Response: full `PartyMember` record `{email, party_id, role, first_name?, last_name?, joined_at, gift_blob?}`.

### Update profile

- PUT `/api/parties/{party_id}/members/{member_id}/profile`
- Request body: `{firstName?, lastName?}`
- Behavior: update only missing fields; do not overwrite nonblank values unless explicitly allowed.

### Add gift details

- POST `/api/parties/{party_id}/members/{member_id}/gifts`
- Request body: `{giftBlob}`
- Behavior: require `customizationEnabled`; save gift blob.
- Response: `{member_id, giftBlob}`

### Lock party

- POST `/api/parties/{party_id}/lock`
- Behavior: mark party locked, prevent membership changes, optionally freeze future gift updates.
- Publish SNS event `party_locked`.

### Assign recipients

- POST `/api/parties/{party_id}/assignments`
- Request body: `{mode: 'automatic'|'manual', assignments?}`
- Behavior: create giver/receiver pairs, publish SNS event `assignment_completed`.

## Auth0 Integration

- All application routes require Auth0 authentication except invitation acceptance start links.
- Use Auth0 email claims as the canonical identity key.
- Support Google login through Auth0 connection configuration.
- On sign-in after invite link click, map the returned email to the pending invitation and party.
- Auth0 configuration values MUST be retrieved from AWS SSM Parameter Store at the following paths:
  - Domain: `/secret-santa/auth0/domain`
  - Audience: `/secret-santa/auth0/audience`
  - Client ID: `/secret-santa/auth0/client_id`
  - Client Secret: `/secret-santa/auth0/client_secret`
- Environment variables MUST NOT be used as the primary source for Auth0 credentials.

### Token Transport

- Bearer tokens MUST NOT be accepted. The `Authorization: Bearer` header MUST NOT be read or
  validated by any middleware or route handler.
- After a successful Auth0 login callback, the `access_token` MUST be set as an `HttpOnly`,
  `Secure`, `SameSite=None` cookie on the response.
- All protected routes MUST authenticate by extracting and validating the JWT from the
  `access_token` cookie.
- User identity and relevant logged-in information MUST be read exclusively from the validated
  `access_token` JWT payload. The email address of the authenticated user MUST be sourced from
  `req.auth.payload['registered_user_email']` (populated by the Auth0 Post-Login Action custom claim).
  Using `req.oidc.user` for identity claim extraction on protected routes is prohibited.
- `req.oidc` MAY be used only for authentication-state checks (`req.oidc.isAuthenticated()`).
- The `GET /api/auth/token` endpoint MUST be removed; it returned the token in a JSON body for
  manual Bearer use, which is prohibited under this model.
- The `src/auth/auth0.ts` module MUST be updated to replace the `express-jwt` Bearer middleware
  with a cookie-reading JWT validation middleware (same JWKS/audience/issuer validation).

## Notification Flow

- Invitation sent: a DynamoDB Stream INSERT event on the `Invitations` table triggers the EventBridge Pipe, which invokes the emailer Lambda to send the invitation email. No SNS publish occurs in the web app.
- Invite accepted: future event-driven handler (not yet implemented).
- Party locked: publish SNS event after lock action.
- Assignment completed: publish SNS event once assignments are generated.
- Gift details updated: optionally publish SNS event if party customization is enabled.

## Non-functional requirements

- Secure token management for invitation links.
- Idempotent assignment generation and lock actions.
- Strong email validation for invitations and Auth0 user association.
- Minimal party data exposure to unauthorized users.
- Domain-driven service boundaries for `user`, `admin`, and `authentication` domains.
- Domain-specific OpenAPI specifications for new party/member APIs.
- DynamoDB-backed storage with AWS-friendly key design and query patterns.

## Success Criteria

- Party creation returns a valid `party_id` and saves the administrator email.
- Invitations generate tokenized links and associate users with the correct party after Auth0 login.
- Users can update blank profile fields and submit gift blobs when allowed.
- Administrators can lock parties and generate assignment mappings.
- SNS events are published for invitation, acceptance, lock, and assignment completion.
