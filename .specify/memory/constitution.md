<!--
## Sync Impact Report

**Version change**: 1.13 → 1.14
**Bump rationale**: PATCH — Token Transport principle clarified: user identity claims MUST be read
exclusively from the validated `access_token` JWT payload (`payload.registered_user_email`).
Reading from `req.oidc.user` is explicitly prohibited for identity claims.

### Modified principles
- `#### Token Transport: Cookie-Only` — removed ambiguous “or from `req.oidc.user`” wording;
  replaced with mandatory `payload.registered_user_email` claim path.

### Added sections
- None.

### Removed sections
- None.

### Templates requiring updates
- ✅ .specify/memory/constitution.md — updated.
- ⚠️ specs/002-party-management-init/spec.md — Token Transport section needs same clarification.
- ⚠️ specs/002-party-management-init/tasks.md — New tasks T034a–T034c to revert controllers
  from `req.oidc.user?.email` to `req.auth?.payload?.['registered_user_email']`.

### Previous amendments
- 1.12 → 1.13 (2026-04-24): Cookie-only auth mandate (Token Transport principle added).
- 1.11 → 1.12 (2026-04-24): Lambda Fire-and-Forget principle added.
- 1.10 → 1.11 (2026-04-24): Emailer input contract updated with token + invitation link section.
- 1.9 → 1.10 (2026-04-24): Extended Lambda Retry Policy to cover EventBridge Pipe source retry.
- 1.8 → 1.9 (2026-04-24): Lambda Retry Policy principle added.
- 1.7 → 1.8 (2026-04-23): Event-Driven Apps principle added with emailer Lambda detail.
- 1.6 → 1.7 (2026-04-23): Event-Driven Apps principle added.
- 1.5 → 1.6 (2026-04-22): Mocking principle added to Testing Requirements.
- 1.4 → 1.5 (2026-04-22): Error Handling principle added.
- 1.3 → 1.4 (2026-04-22): Security/HTTPS requirement added.
- 1.2 → 1.3 (2026-04-22): Observability route-logging requirement added.
- 1.1 → 1.2 (2026-04-22): Build tooling (tsx/tsc) rules added.
- 1.0 → 1.1 (2026-04-22): Auth0 SSM enforcement.

### Follow-up TODOs
- TODO(TERRAFORM_VERSION): Terraform required_version is currently >= 1.3.0; constitution requires 1.14.8.
  Update when Terraform 1.14.x is available on the build machine.
-->

# Secret-Santa-BE V2 Constitution

## Core Principles
Any mention of API or application is distinctive from Terraform.
Any mention of "run build" means "npm run build"
Use tsx to run the program locally as part of "start" in package.json
Use tsc to build the program for deployment purposes.

### Domain Driven
There are three domains: "user", "admin", "authentication". Each covers it's own domain which represents a logical seperation from the other domains. Each domain should be able to be independently deployed.

### AWS Based
Each domain should be deployed as it's own ECS Task (within its own target group), behind a load balancer. The load balancer should have event rules that direct traffic to the correct target group.

DynamoDB will be the backend database that will store data for this application.

### OpenAPI Spec Control
All domains should have it's own OpenAPI Spec that can be leveraged for testing

### Language Requirements
Must use node 25.8.2, typescript 6.0.2.

#### Typescript requirements
verbatimModuleSyntax is set to true, ensure to always follow verbatim syntax

### Observability
Every method should be able to be traced with logs. It is important to understand how a call is traveling through the API.
All registered API URL routes MUST be logged via `Logger.info` immediately after the application server starts.

### Authentication
Auth0 MUST be used as the authentication mechanism for all resources. Auth0 configuration values MUST be retrieved from AWS SSM Parameter Store. The following paths MUST be used:
- Domain: `/secret-santa/auth0/domain`
- Audience: `/secret-santa/auth0/audience`
- Client ID: `/secret-santa/auth0/client_id`
- Client Secret: `/secret-santa/auth0/client_secret`

Environment variables MUST NOT be used as the primary source for Auth0 credentials. Hardcoded fallback values are prohibited.

#### Token Transport: Cookie-Only

Bearer tokens MUST NOT be accepted on any route. The `Authorization: Bearer` header MUST NOT be
read or validated by any middleware or route handler.

After a successful Auth0 login (i.e., at the end of the OIDC callback), the `access_token` MUST be
stored in an `HttpOnly`, `Secure`, `SameSite=None` cookie. All subsequent authenticated requests
MUST present the `access_token` cookie; the server MUST extract and validate the JWT from that
cookie.

- `express-jwt` configured to read from `Authorization: Bearer` MUST NOT be used.
- A cookie-reading JWT validation middleware MUST replace it. The middleware MUST validate the
  token's signature (JWKS), audience, and issuer identically to how `express-jwt` did, but source
  the token from the cookie, not the `Authorization` header.
- The `GET /api/auth/token` endpoint that returned tokens in a JSON response body (for manual Bearer
  use) MUST be removed or repurposed — it MUST NOT return tokens in a way that enables Bearer usage.
- User identity and other relevant claims MUST be read exclusively from the validated `access_token`
  JWT payload. The email address of the logged-in user MUST be sourced from
  `req.auth.payload['registered_user_email']` (set by the Auth0 Post-Login Action). Reading identity
  from `req.oidc.user` (OIDC session) is **prohibited** for claim extraction on protected routes.
- `req.oidc` (OIDC session) MAY be used only for checking authentication state
  (`req.oidc.isAuthenticated()`), not for extracting user identity claims.

**Rationale**: Cookie-based token transport is more secure for browser clients. `HttpOnly` cookies
are inaccessible to JavaScript, eliminating XSS-based token theft. The server controls token
lifetime via cookie expiry and can invalidate sessions without client coordination.

#### Member Self-Authorization

A party member MUST only be able to read or modify their own profile and gift data. On every
route matching `/api/parties/{party_id}/members/{member_id}/*`, the server MUST enforce the
following check before invoking any service:

1. Decode `req.params.member_id` with `decodeURIComponent` and lowercase it.
2. Read the authenticated user's email from
   `req.auth.payload['registered_user_email']` and lowercase it.
3. If the two values do not match, respond immediately with **HTTP 403 Forbidden** and
   do not proceed to any service call.

This applies to all operations on member-scoped routes:
- `GET /api/parties/{party_id}/members/{member_id}/profile`
- `PUT /api/parties/{party_id}/members/{member_id}/profile`
- `POST /api/parties/{party_id}/members/{member_id}/gifts`

Administrative routes that act on behalf of a different member (e.g., viewing another
member's profile for party management purposes) MUST use a separate, explicitly admin-guarded
route and MUST NOT reuse the member-scoped routes above.

**Rationale**: A member's profile and gift list contain personal preference information that
should only be accessible and editable by the owner. Relying solely on `party_id` membership
would allow one member to overwrite another member's data using a valid token — the URL
parameter MUST be validated against the token claim on every request.

### Security
HTTPS MUST be used for all network communication in deployed environments. HTTP MUST NOT be used.
- The ALB MUST be configured with an HTTPS listener. Any HTTP traffic MUST be redirected to HTTPS at the ALB level.
- The `BASE_URL` environment variable MUST be set to an `https://` URL in all non-local deployments.
- Local development using `npm start` (tsx + localhost) is exempt from the HTTPS requirement.

### Event-Driven Apps
Any application that is triggered by an event (e.g., SNS message, SQS queue, EventBridge rule,
or DynamoDB stream) rather than a synchronous HTTP request MUST follow these rules:

- MUST be built for deployment to AWS Lambda.
- MUST be independently built and packaged separately from all other applications in the suite.
  It MUST NOT share a build artifact or Dockerfile with any ECS-hosted API.
- MUST be focused on a singular purpose. A Lambda function MUST handle one logical operation
  (e.g., send an invitation email, process a draw result). Multi-purpose handlers are prohibited.
- MUST be placed in the `lambdas/<lambda-name>/` subdirectory of the SECRET-SANTA-V2 project
  repository (e.g., `lambdas/emailer/`). Each Lambda is its own self-contained TypeScript project
  within that subdirectory.

**Rationale**: Lambda's event-driven execution model is purpose-built for discrete, stateless
operations triggered asynchronously. Keeping each function single-purpose and independently
built ensures minimal blast radius on failure, faster cold starts, and clear separation of
deployment ownership.

#### Lambda: Fire-and-Forget (EventBridge-triggered)

Every Lambda function triggered via an EventBridge Pipe MUST be configured as fire-and-forget.
AWS MUST invoke the Lambda exactly once; no automatic retries are permitted at any layer.

The following MUST be set via Terraform for every EventBridge-triggered Lambda:

- `aws_lambda_function_event_invoke_config.maximum_retry_attempts` MUST be **0**.
- `dynamodb_stream_parameters.maximum_retry_attempts` (or the equivalent field on other Pipe source
  types — `sqs_queue_parameters`, `kinesis_stream_parameters`, etc.) MUST be **0**.
- Dead-letter queues and on-failure destinations MUST NOT be configured on EventBridge-triggered
  Lambdas (they would contradict the fire-and-forget contract).

**Rationale**: EventBridge-triggered Lambdas in this project drive side effects (email delivery,
notifications). Retrying side-effect operations after a transient failure risks duplicate sends and
message storms. Fail fast, surface the error immediately, and let observability tooling alert on
failures rather than masking them with silent retries.

#### Lambda: emailer

**Purpose**: Sends transactional emails triggered by new invitation records in DynamoDB.

**Directory**: `lambdas/emailer/`

**Build**: TypeScript. The `tsconfig.json` for this Lambda MUST reference (extend) the root
`tsconfig.json` of the SECRET-SANTA-V2 project to ensure consistent compiler settings.

**Input contract**: The Lambda receives an event from EventBridge containing:
```json
{
  "email": "<recipient email address from the Invitation record>",
  "messageObject": {
    "bucket": "<S3 bucket name>",
    "object": "<S3 object path and file name>"
  },
  "eventIdentifier": "<party_id from the Invitation record>",
  "token": "<invitation token from the Invitation record>"
}
```
Use placeholder values for `bucket` and `object` until real S3 resources are provisioned.

**Invitation link construction**: The Lambda MUST construct a clickable acceptance link and substitute
it into the email body. The link format is:
```
{INVITATION_BASE_URL}/parties/{eventIdentifier}/invitations/{token}
```
- `INVITATION_BASE_URL` is read from the Lambda environment variable of the same name.
  Default value: `https://127.0.0.1/api`.
- The placeholder string `<placeholder for link that directs to join the party with the party id>`
  in the email body MUST be replaced with the fully-constructed link.
- If either `eventIdentifier` or `token` is absent the placeholder is replaced with an empty string
  and a warning is logged.

**S3 message resolution**: On invocation the Lambda MUST perform an S3 `GetObject` call using
`messageObject.bucket` and `messageObject.object` to retrieve the email content. The S3 object
MUST contain a JSON body with `subject` and `message` fields. The Lambda reads these fields
and sends the email to the address supplied in `email`.

**EventBridge trigger**:
- Rule name: `secret-santa-new-invitation-record`
- Source: DynamoDB Streams via EventBridge Pipes (or a direct EventBridge rule on the
  Invitations table stream).
- Filter: MUST match only events where the record is a **new insert** (`eventName = INSERT`)
  AND the `status` field on the new image equals `"pending"`.
- When the filter matches, EventBridge passes the following fields to the Lambda invocation
  payload via the Pipe's `input_template`:
  - `email` — from `$.dynamodb.NewImage.email.S`
  - `messageObject` — static S3 coordinates (`bucket`, `object`)
  - `eventIdentifier` — from `$.dynamodb.NewImage.party_id.S`
  - `token` — from `$.dynamodb.NewImage.token.S`

**Infrastructure ownership**:
- The EventBridge rule MUST be created and managed by Terraform.
- The Lambda function MUST be created and managed by Terraform.
- IAM role for the Lambda MUST grant: `s3:GetObject` on the message-content bucket,
  `ses:SendEmail` (or equivalent email-send permission), and `logs:CreateLogGroup` /
  `logs:CreateLogStream` / `logs:PutLogEvents` for CloudWatch.

### Error Handling
All calls to downstream systems MUST be wrapped in a `try/catch` block. This applies to all AWS
SDK calls (DynamoDB, SSM, SNS), HTTP client calls, and Auth0 operations.

- Unhandled promise rejections and uncaught exceptions MUST NOT crash the application.
- Caught errors MUST be logged via `Logger.error` with sufficient context to diagnose the failure.
- The caller MUST receive a controlled failure response (e.g., HTTP 500 with a structured error
  body) rather than an uncaught exception propagating to the runtime.

**Rationale**: Downstream failures are expected in distributed systems. Crashing an ECS task due
to a transient DynamoDB timeout degrades availability for all users. Structured error responses
enable observability and client-side retry logic.

## Infrastructure
### AWS
AWS is the hosting platform for this suite of applications. Environments include 'dev', 'prod'.

### Terraform
Use Terraform 1.14.8 to interact with AWS. Ensure to use best practices when constructing Terraform structure. The terraform structure must be in it's own project and define the setup for the entire suite of applications. Terraform will store tsstate within S3.

#### Variables
All variable definitions must be stored on a per environment basis. Ensure to prioritize creating variables for items that would require adjusting based on the environment it is currently in, such as size requirements, name definitions (where it will vary).

## Development Workflow
### Phase 1: Code modifications
1. Developer creates a repository branch (/feat, /bugix, /hotfix) based off the 'main' branch 
2. Developer checks out the code from the repository branch just created
3. Developer writes code modifications which includes additional or modified test cases based off the code modifications made
4. Developer performs typescript build (npm run build) to ensure proper build as well as run all the tests to ensure 100% pass rate, and 90% coverage
5. Developer commits and pushes to a repository branch based off the 'main' branch

### Phase 2: PR Process
1. Developer creates a PR which requests the code to be merged into 'main'
2. GitHub Actions runs a pipeline based off of the PR which runs the typescript build and test to ensure everything passes.
3.a If the developer requires modifications based on reviews or build/test failures, the developer proceeds with Phase 1 again to correct the code
3.b If the developer gets all necessary approvals, the developer merges the code into the 'main' branch

### Phase 3: GitHub Actions
1. GitHub Actions performs a build and test based off the new code that has been merged into 'main'
2. GitHub Actions stores the artifact from the build to pass to the deployment step
3. For Terraform, GitHub Actions will execute the build to modify the AWS infrastructure. For API builds, the artifact built will be deployed as a new ECR image and a new task version will be created for the related API, which is then deployed for the ECS service.
4. GitHub Actions needs to perform health checks either on its own by triggering the API or via CLI on the target group. Health checks are required for the build to pass, if the health check fails, then the build fails.

## Build

### Docker
Each API will be built using Docker. Use node:lts-alpine as the base image. Each Docker image must be able to be accessed through the network from the underlying EC2 system that is used.

#### Naming
API images will be named as the following - secret-santa-v2-[the domain]

### Application Build
Each application will be built using GitHub Actions. The application must perform a pipeline with basic typescript build and testing feature before it proceeds to deploy the application.

## Testing Requirements

### Unit Testing
Ensure that there is a 90% unit coverage for every typescript project. Ensure that tests are not overly complex and test simple flows with minimal changes to characters for basic functionality and logical checks.

### Mocking
All downstream system calls MUST be mocked in every Jest test. This applies to:
- AWS DynamoDB (`@aws-sdk/lib-dynamodb` — `dynamoClient.send`)
- AWS SNS (`@aws-sdk/client-sns` — `snsClient.send`)
- AWS SSM (`@aws-sdk/client-ssm` — `ssm.send`, or via `src/utils/config.ts` — `getConfigParam`)
- Auth0 / `express-openid-connect` (`auth()`, JWT middleware)
- Any HTTP client call to an external service

No Jest test MUST make a real network call to AWS or any external system. Use `jest.mock()` at
the module level to intercept these dependencies before the module under test is loaded.

**Rationale**: Tests that depend on live AWS credentials or network connectivity are non-deterministic,
slow, and fail in CI environments without deployed infrastructure. Mocking ensures the test suite
runs reliably on any machine with `npm test`.

## Web Access
### Route53
Route53 is being used with 'reinhardtvanwyk.com' as the CNAME record. The full CNAME will be 'secretsantabe.reinhardtvanwyk.com'.

### ALB
Route 53 will connect to the ALB which will handle load balancing on the traffic. An existing VPC named 'reinhardtvanwyk.com_2' will be used. Public and private subnets exists. Routing will take place based off the uri to target groups.
- /admin -> admin domain
- /user -> user domain
- /auth -> auth domain

### Target Group Routing
Target groups will be created and will use the smallest instance of EC2 available. Prefer general performance. Prefer free tier eligible. Standard health checks are fine.

**Version**: 1.15 | **Ratified**: 2026-04-17 | **Last Amended**: 2026-04-24
