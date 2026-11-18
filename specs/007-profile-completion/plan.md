# Implementation Plan: Profile Completion

**Branch**: `007-profile-completion` | **Date**: 2026-11-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/007-profile-completion/spec.md`

## Summary

Store names in a DynamoDB account profile independent of party membership. Add authenticated self-service profile routes, reuse unambiguous membership names on read, and open the dashboard completion dialog only after a successful incomplete-profile response. Enrich joined-party and pending-invite responses with the host's display name so those cards never substitute the viewer's name for the host's.

## Technical Context

**Language/Version**: Node 25.8.2, TypeScript 6.0.2 with `verbatimModuleSyntax`
**Primary Dependencies**: Existing Express, Auth0 cookie JWT middleware, AWS SDK v3, React, Material UI, Vite, Terraform 1.14.8
**Storage**: New DynamoDB `UserProfiles` table; read-only legacy fallback from `PartyMembers`
**Testing**: Jest, Supertest, React Testing Library, Terraform validation, browser smoke test on dev
**Target Platform**: Existing single-EC2 HTTPS deployment and local Vite proxy; no topology change
**Project Type**: Web application with TypeScript API
**Performance Goals**: One account lookup per profile load; at most one resolution per distinct host per list request; no additional client request per card
**Constraints**: No bulk migration, no membership writes, no shared cache, no custom Auth0 claims or notifications
**Scale/Scope**: Dashboard greeting, completion dialog, joined-party and pending-invite host labels

## Constitution Check

| Gate | Pre-research | Post-design |
|---|---|---|
| User domain remains separate from authentication and administration | Pass | Self-profile logic lives in user controller/service; no new public auth route or admin write. |
| Cookie JWT and self-authorization | Pass subject to claim-shape alignment | The current verifier exposes flat claims; align the verifier and shared identity helper to `req.auth.payload['registered_user_email']` and update their fixtures together. Keep cookie extraction, issuer, audience and signature checks unchanged; no OIDC-session identity or Bearer fallback. |
| DynamoDB, Terraform, HTTPS and least privilege | Pass | Add a table and a separate table-scoped `GetItem`/`PutItem` grant in the EC2 role; continue using HTTPS and existing SSM/instance-profile configuration. |
| OpenAPI, route logging, controlled errors | Pass | Specify user-domain operations, mount beneath the existing JWT router and startup route logger, and log caught downstream errors without name values. |
| Toolchain and tests | Pass | No new runtime dependencies; use type-only imports as required, run builds and existing tests with downstream mocks, and verify 90% unit coverage. |

No exceptions or unresolved clarifications.

## Project Structure

```text
specs/007-profile-completion/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/user-profile.openapi.yaml

backend/src/
├── auth/auth0.ts
├── controllers/{index,meController,pendingInvitesController}.ts
├── services/{accountProfileService,meService}.ts
└── utils/requestHelpers.ts
frontend/src/
├── api/partyApi.ts
├── pages/MainPage.tsx
├── components/{PartyMemberCard,PendingInviteCard}.tsx
├── components/modals/CompleteProfile.tsx
└── types/api.ts
docs/openapi.yaml
terraform/{main,compute}.tf
tests/{unit,contract,integration}/
```

**Structure decision**: Add the self routes to the existing `me` controller behind JWT validation in `index.ts`; keep account persistence and legacy resolution in a user-domain service. Keep the dialog in the existing modal directory and colocate frontend tests.

## Phase 0: Research

See [research.md](./research.md) for storage, legacy resolution, authentication, and dashboard decisions.

## Phase 1: Design

- [Data model](./data-model.md): account profile keys, name precedence, and conditional completion.
- [OpenAPI contract](./contracts/user-profile.openapi.yaml): self read/write and additive host-name fields. Implement alongside corresponding updates to the existing application OpenAPI document.
- [Quickstart](./quickstart.md): validation cases, release order, and rollback.

## Phase 2: Implementation Sequence

1. Define the table and least-privilege access; implement account profile resolution and atomic completion with mocked DynamoDB tests.
2. Verify the JWT claim shape and add the self routes, input validation, and contract/integration tests. Preserve party-member authorization and cover regressions in existing `/me` routes.
3. Implement dashboard profile loading, retry, and modal; update the header from the saved response. Ship this slice only after the backend routes are available.
4. Add server-side host display names to the two card feeds and prefer them in the frontend. On a host lookup error, log it and leave the field absent so the card retains its existing email fallback. After a successful save, update visible cards hosted by the caller from the response without waiting for a refresh.
5. Run the checks and smoke tests, then deploy storage/IAM before API and UI. Roll back application code without deleting profiles.

Generate dependency-ordered tasks with `/speckit.tasks`; this planning phase does not implement application changes.
