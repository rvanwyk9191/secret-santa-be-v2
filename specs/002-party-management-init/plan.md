# Implementation Plan: Party Management, Auth0 Registration, and SNS Notification

**Branch**: `002-party-management-init` | **Date**: 2026-04-17 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-party-management-init/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Build a party-based secret-santa gift exchange service where authenticated users create parties, invite participants via tokenized email links, and trigger assignment generation. Auth0 provides identity via JWT; AWS SNS delivers notification events; DynamoDB persists all domain data. The implementation follows domain-driven boundaries (`user`, `admin`, `authentication`) each independently deployable as ECS tasks behind an ALB.

## Technical Context

**Language/Version**: Typescript 6.0.2, Node 25.8.2, Terraform@Latest
**Primary Dependencies**: aws-sdk, auth0
**Storage**: DynamoDB, SSM Parameter Store
**Testing**: Jest
**Target Platform**: Linux Server (EC2 Autoscaling Group), ECS
**Project Type**: web-service
**Performance Goals**: 100 req/s
**Constraints**: memory 4 GiB, 1 GB Storage
**Scale/Scope**: Small set of internal users
**Local Run**: `npm start` → `tsx src/controllers/index.ts` (TypeScript executed directly via tsx)
**Deployment Build**: `npm run build` → `npx tsc` (compiled to `dist/` via tsc for Docker/ECS deployment)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|-----------|------|--------|
| **Build Tools** | `npm start` MUST use `tsx` for local execution. `npm run build` MUST use `tsc` for deployment build. `tsx` MUST be a `devDependency` in `package.json`. | ✅ `tsx@4.21.0` installed; scripts confirmed in package.json |
| **Auth0 / SSM (BLOCKING)** | `src/auth/auth0.ts` MUST retrieve `domain`, `audience`, `client_id`, and `client_secret` from SSM paths `/secret-santa/auth0/*`. No env-var fallbacks, no hardcoded values. MUST be implemented before any Auth0-protected route is exercised. | ✅ Phase 4.5 complete (T025a–T025d) |
| **Domain Driven** | Party management spans `user`, `admin`, and `authentication` domains. Each domain MUST remain independently deployable. | ✅ Routing separates domains by ALB path prefix |
| **AWS Based** | All persistence via DynamoDB. Notifications via SNS. Secrets via SSM. | ✅ Confirmed in data model and notification flow |
| **Observability** | Every method MUST emit structured log entries traceable through controller → service layers. | ✅ Logger utility applied in all controllers/services |
| **Auth0 Login Flow** | An Authorization Code Flow MUST be exposed via `express-openid-connect` at `/api/auth/login`, `/api/auth/callback`, `/api/auth/logout`. All config (domain, clientID, clientSecret, audience, sessionSecret, baseURL) MUST be sourced from SSM. A `GET /api/auth/token` endpoint MUST return the access_token for Bearer-token testing. | ✅ Phase 4.6 complete (T025e–T025j) — `src/auth/authRouter.ts` + wired in `index.ts` |
| **HTTPS / Security** | HTTPS MUST be used in all deployed environments. ALB MUST redirect HTTP → HTTPS. `BASE_URL` env var MUST use `https://` in non-local deployments. Local `localhost` is exempt. | ✅ T025k runtime guard in `src/auth/authRouter.ts`; T025l unit test covers violation + localhost exemption (9 tests passing) |
| **Error Handling** | All downstream calls (DynamoDB, SSM, SNS, Auth0) MUST be wrapped in `try/catch`. Errors MUST be logged via `Logger.error` and surface as controlled HTTP error responses. | ✅ Phase 2.1 complete (T017d–T017k) — all service try/catch added; global Express error handler in `index.ts`; 5 unit tests passing |
| **Test Mocking** | All AWS SDK calls (DynamoDB, SNS, SSM) and Auth0 calls MUST be mocked in every Jest test via `jest.mock()`. No test may make real network calls. | ✅ Phase 2.2 complete (T017l) — all 7 test suites use mocks; 28/28 pass |
| **TypeScript** | `verbatimModuleSyntax: true`. No implicit any. Strict null checks. | ✅ tsconfig enforces these settings |
| **OpenAPI Spec** | Each domain MUST have its own OpenAPI spec for testing and contract validation. | ⚠️ T053 covers this in Phase 8 |
| **Terraform** | Terraform MUST manage all AWS infrastructure. State stored in S3. | ⚠️ Local state in use (development only); S3 backend required before prod |

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

### Source Code (repository root)

```text
src/
├── models/        # DynamoDB entity types (Party, PartyMember, Invitation, Assignment, NotificationEvent)
├── services/      # Core business logic (party, invitation, registration, profile, gift, assignment, notification)
├── controllers/   # Express route handlers per domain endpoint
├── utils/         # Logger, error handler, SSM config helper
└── auth/          # Auth0 JWT middleware (config sourced from SSM)

tests/
├── contract/      # Response-shape contract tests per endpoint
├── integration/   # Service-level integration tests with mocked AWS calls
└── unit/          # Unit tests for utilities and auth config
```

**Structure Decision**: 
- Backend API
  - models - contains database models
  - services - contains core logic to derive functionality for the applications
  - controllers - contains endpoint details and routes to related services
  - utils - contains any additional utility functionality that doesn't quite fit in model, services, controllers
  - auth - contains the authentication details to validate with auth0
- Terraform
  - compute - contains ECS, ECR, EC2 related infrastructure
  - storage - contains DynamoDB and SSM Parameter Store infrastructure

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**
