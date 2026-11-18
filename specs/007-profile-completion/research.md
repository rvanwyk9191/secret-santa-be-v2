# Research: Profile Completion

## Account-level storage

**Decision**: Use a new DynamoDB `UserProfiles` table keyed by normalized `registered_user_email`, with no secondary index.

**Rationale**: The application already uses this identity for party ownership, memberships, and invitations. An account record remains available to users with no parties and survives party deletion.

**Alternatives considered**: Updating every membership misses zero-party users and can leave partial writes. Auth0 profile metadata is not the application's DynamoDB data source and would add a dependency and permissions.

## Legacy values

**Decision**: Resolve missing names independently from all pages of that email's memberships. Ignore blank values and use a field only if its nonblank trimmed values agree exactly. Do not write during read.

**Rationale**: Existing users do not have to re-enter reliable values; a conflict can't silently select the first party. A failed membership query is not evidence that a name is missing.

**Alternatives considered**: An eager backfill requires a separate migration and write deployment. First-membership fallback conflicts with the specification.

## Authentication and writes

**Decision**: Reuse the cookie JWT, normalize its verified claim shape at the authentication boundary, and derive the owner only from the registered email claim. Accept an exact JSON payload on `PUT` from the configured browser origin, without cross-origin access. Conditionally replace the observed incomplete record, or create it if absent.

**Rationale**: The client cannot choose an account. Origin and content-type checks protect the cookie-authenticated write. The conditional write avoids lost updates, and retries of the same completed names can succeed without opening a general editing path.

**Alternatives considered**: A path or body account identifier adds no useful capability. An unconditional update allows a stale tab to overwrite a completed profile.

## Host names and UI state

**Decision**: Add `host_display_name` to existing list entries only for complete host names; resolve each distinct host once per request with bounded concurrency. Load the viewer's profile separately from the dashboard lists.

**Rationale**: The dashboard can distinguish a missing name from a load failure, and a card can keep working when host enrichment fails. Only the combined display label is exposed to viewers already authorized to see the card.

**Alternatives considered**: Per-card browser lookups add traffic and would require a public lookup interface. Reusing the viewer's profile would mislabel other hosts.
