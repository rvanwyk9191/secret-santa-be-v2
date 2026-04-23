# Feature Specification: Emailer Lambda

**Feature Branch**: `003-emailer-lambda`  
**Created**: 2026-04-23  
**Status**: Draft  
**Input**: User description: "Lambda emailer — triggered by EventBridge on new pending Invitation records; resolves email content from S3; sends transactional email."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Invitation email delivered on new pending record (Priority: P1)

When a new Invitation record is inserted into DynamoDB with a status of "pending", the system
automatically sends an email to the invitee without any manual action from the administrator.

**Why this priority**: This is the entire purpose of the emailer Lambda. Without it, invited
participants never receive their invitation links and cannot join the party.

**Independent Test**: Insert a new Invitation record with `status: "pending"` into the Invitations
table. Verify that the emailer Lambda is invoked and an email is dispatched to the address stored
in `Invitation.email`.

**Acceptance Scenarios**:

1. **Given** a new Invitation record is inserted with `status: "pending"`,
   **When** EventBridge detects the DynamoDB INSERT event,
   **Then** the `secret-santa-new-invitation-record` EventBridge rule fires and invokes the emailer Lambda with the invitee's email address and the S3 messageObject coordinates.

2. **Given** the Lambda is invoked with a valid email and messageObject,
   **When** the Lambda performs a `GetObject` call on the specified S3 bucket and object,
   **Then** the Lambda retrieves a JSON body containing `subject` and `message` fields and sends the email to the supplied address.

3. **Given** an existing Invitation record is updated (not a new insert),
   **When** EventBridge evaluates the event,
   **Then** the EventBridge filter rejects the event and the Lambda is NOT invoked.

4. **Given** a new Invitation record is inserted with `status` other than `"pending"`,
   **When** EventBridge evaluates the event,
   **Then** the EventBridge filter rejects the event and the Lambda is NOT invoked.

---

### User Story 2 — Email content resolved from S3 at runtime (Priority: P2)

Email subject and body are not hardcoded in the Lambda. They are stored as a JSON object in S3
and fetched at invocation time, allowing content updates without redeploying the function.

**Why this priority**: Decoupling content from code is essential for maintainability. It allows
email templates to be updated independently of the Lambda deployment lifecycle.

**Independent Test**: Update the S3 object content and trigger the Lambda — the email should
reflect the new subject/message without any code change or redeployment.

**Acceptance Scenarios**:

1. **Given** the Lambda receives a messageObject with a valid `bucket` and `object`,
   **When** it performs a `GetObject` call,
   **Then** it parses the response body as JSON and extracts `subject` and `message`.

2. **Given** the S3 object is unreachable or the key does not exist,
   **When** the Lambda attempts `GetObject`,
   **Then** the Lambda logs the error via the standard error logging pattern and does not silently swallow the failure.

3. **Given** the S3 object exists but contains malformed JSON,
   **When** the Lambda parses the response,
   **Then** the Lambda logs a descriptive parse error and does not send an email with undefined content.

---

### Edge Cases

- What happens when the S3 object is missing or the bucket name is wrong? → Lambda logs error and does not send.
- What happens when the email send service is unavailable? → Lambda logs error; EventBridge/Lambda retry policy governs retry behaviour.
- What happens when `email` in the EventBridge payload is empty or malformed? → Lambda validates input and logs a descriptive error before attempting a send.
- What happens if the DynamoDB stream delivers a duplicate event? → Idempotency is handled by the email provider; the Lambda itself is stateless and will attempt a send per invocation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Lambda MUST accept an event payload containing `email` (string) and `messageObject` (`{ bucket: string, object: string }`).
- **FR-002**: The Lambda MUST perform an S3 `GetObject` call using `messageObject.bucket` and `messageObject.object` to retrieve email content.
- **FR-003**: The S3 object content MUST be parsed as JSON; the Lambda MUST extract `subject` and `message` fields.
- **FR-004**: The Lambda MUST send a transactional email to the address in `email` using the resolved `subject` and `message`.
- **FR-005**: The EventBridge rule MUST be named `secret-santa-new-invitation-record`.
- **FR-006**: The EventBridge rule MUST filter events to only those where the DynamoDB event type is `INSERT` AND the `status` field on the new image equals `"pending"`.
- **FR-007**: When the filter matches, EventBridge MUST pass `email` (from `Invitation.email`) and `messageObject` (placeholder S3 coordinates) to the Lambda invocation payload.
- **FR-008**: Placeholder values MUST be used for `messageObject.bucket` and `messageObject.object` until real S3 resources are provisioned.
- **FR-009**: The Lambda MUST be written in TypeScript. Its `tsconfig.json` MUST extend the root `tsconfig.json` of the SECRET-SANTA-V2 project.
- **FR-010**: The Lambda source MUST reside in `lambdas/emailer/` within the SECRET-SANTA-V2 project repository.
- **FR-011**: The Lambda MUST be packaged and built independently from all ECS-hosted APIs.
- **FR-012**: The EventBridge rule, Lambda function, and associated IAM role MUST be created and managed by Terraform.
- **FR-013**: The Lambda IAM role MUST grant: `s3:GetObject` on the message-content bucket, `ses:SendEmail` (or equivalent), and `logs:CreateLogGroup` / `logs:CreateLogStream` / `logs:PutLogEvents`.
- **FR-014**: All S3, SES/email-send, and EventBridge calls within the Lambda MUST be wrapped in `try/catch` per the constitution Error Handling principle.

### Key Entities

- **Invitation** (existing DynamoDB record): `party_id`, `email`, `token`, `status` — the INSERT of a record with `status: "pending"` is the trigger event.
- **EmailerEvent**: `{ email: string, messageObject: { bucket: string, object: string } }` — the normalized payload passed from EventBridge to the Lambda.
- **EmailContent** (resolved from S3): `{ subject: string, message: string }` — the email template content stored as a JSON object in S3.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every new Invitation record with `status: "pending"` results in exactly one email dispatch attempt within 60 seconds of the DynamoDB write.
- **SC-002**: Zero emails are triggered for Invitation records that are updated (non-INSERT) or inserted with a status other than `"pending"`.
- **SC-003**: All Lambda invocation errors (S3 fetch failures, parse errors, email send failures) are observable via CloudWatch Logs within 5 seconds of the failure occurring.
- **SC-004**: Email content can be updated in S3 and takes effect on the next Lambda invocation without any code change or redeployment.
- **SC-005**: The Lambda build, test, and deploy pipeline completes independently of the ECS API pipelines with no shared artifact dependencies.

## Assumptions

- Placeholder values (`bucket: "PLACEHOLDER_BUCKET"`, `object: "PLACEHOLDER_OBJECT_KEY"`) are used for S3 messageObject until real S3 resources are provisioned via Terraform.
- AWS SES (or equivalent) is approved for sending in the target AWS account and region (`us-east-1`).
- The DynamoDB Invitations table has Streams enabled with `NEW_IMAGE` or `NEW_AND_OLD_IMAGES` view type so EventBridge Pipes can read the new record attributes.
- The root-level `tsconfig.json` in the SECRET-SANTA-V2 project is the authoritative TypeScript configuration; the Lambda's `tsconfig.json` will extend it.
- The Lambda does not maintain state between invocations; retry and deduplication behaviour is governed by the EventBridge/Lambda retry configuration.
- Email deliverability (DNS, SPF, DKIM) is configured separately and is out of scope for this feature.
