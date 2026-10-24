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
- Use AWS SNS for email notification events.
- Align the feature with domain-driven service separation, DynamoDB-backed data stores, and AWS deployment best practices.

## Architecture alignment

- The party management flows should fit within the existing `user`, `admin`, and `authentication` domains.
- Each domain should remain independently deployable behind the ALB via its own ECS task and route.
- New APIs should be captured in a domain-specific OpenAPI spec to support testing and contract validation.

## Actors

- Party Administrator: creates a party, invites members, locks the party, and triggers assignments.
- Invited Participant: receives an invitation, authenticates through Auth0, and joins the party.
- Auth0 / Google Authenticator: provides authentication and verified email identity.
- Email Notification System (SNS): delivers event notifications to participants.

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
- Links in invitation emails contain the `party_id` and token.
- Clicking the link leads to an Auth0 login/signup flow.
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

### Email notifications via SNS

- Use AWS SNS as the notification service.
- Publish notifications for at least:
  - invitation sent
  - invitation accepted / joined
  - party locked
  - assignments completed
  - gift submission updated (optional)
- Messages should be delivered to participant emails and optionally to the administrator.
- SNS can be used to trigger downstream email delivery or webhook integration.

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
- Behavior: create invitation token, send SNS notification, persist invite.
- Response: `{invitation_id, token, party_id}`

### Accept invitation

- GET `/api/parties/{party_id}/invitations/{token}`
- Behavior: verify link, redirect through Auth0 login, then associate email with party.

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

## Notification Flow

- Invitation sent: publish SNS event with party and invite metadata.
- Invite accepted: publish SNS event when user joins the party.
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
