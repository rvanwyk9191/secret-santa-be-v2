<!--
## Sync Impact Report

**Version change**: 1.7 → 1.8
**Bump rationale**: MINOR — `### Event-Driven Apps` expanded with full specification for the
"emailer" Lambda: input contract, S3 message resolution, EventBridge filter/trigger rules,
Terraform ownership, TypeScript build requirements, and project directory placement.

### Modified principles
- `### Event-Driven Apps` — added Lambda placement rule + full emailer subsection.

### Added sections
- `#### Lambda: emailer` under Event-Driven Apps.

### Removed sections
- None.

### Templates requiring updates
- ⚠️ .specify/templates/tasks-template.md — Add Lambda/Event-Driven task type guidance to
  Phase 2 section when a new Lambda feature spec is started.

### Previous amendments
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
  }
}
```
Use placeholder values for `bucket` and `object` until real S3 resources are provisioned.

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
- When the filter matches, EventBridge passes `email` (from `Invitation.email`) and
  `messageObject` (placeholder S3 coordinates) to the Lambda invocation payload.

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

**Version**: 1.8 | **Ratified**: 2026-04-17 | **Last Amended**: 2026-04-23
