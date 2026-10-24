# Tasks: Emailer Lambda

**Input**: Design documents from `specs/003-emailer-lambda/`
**Available docs**: spec.md ✅ | plan.md ❌ (not yet generated) | data-model.md ❌ | contracts/ ❌
**Constitution version**: 1.8
**Feature**: Standalone TypeScript Lambda — `lambdas/emailer/` — invoked by EventBridge on new pending Invitation records; resolves email content from S3; sends via SES.

> **Note**: Tasks generated from spec.md only (no plan.md). Terraform paths assume a
> `terraform/` directory within the current project; adjust if Terraform lives in a separate repo.

---

## Checklist Reference

See [checklists/requirements.md](checklists/requirements.md) for spec quality gate status.

---

## Phase 1: Setup

**Purpose**: Create the `lambdas/emailer/` project structure as a self-contained TypeScript Lambda project, independent of the ECS-hosted API.

- [x] T001 Create directory structure `lambdas/emailer/src/`, `lambdas/emailer/src/services/`, `lambdas/emailer/src/types/`, `lambdas/emailer/src/utils/`, `lambdas/emailer/tests/unit/`
- [x] T002 Create `lambdas/emailer/package.json` with dependencies: `@aws-sdk/client-s3`, `@aws-sdk/client-ses`; devDependencies: `typescript`, `ts-jest`, `jest`, `@types/jest`, `@types/node`, `@types/aws-lambda`
- [x] T003 [P] Create `lambdas/emailer/tsconfig.json` extending root `tsconfig.json` — set `"extends": "../../tsconfig.json"`, override `rootDir` to `./src`, `outDir` to `./dist`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core types, utilities, and test infrastructure that all user story tasks depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

**Test Mocking (Constitution v1.8)**: All tests MUST mock `@aws-sdk/client-s3` and `@aws-sdk/client-ses` via `jest.mock()`. No test may make real network calls.

- [x] T004 Create `lambdas/emailer/jest.config.js` — configure `ts-jest` with `preset: 'ts-jest'`, `testEnvironment: 'node'`, `moduleNameMapper` for `.js` extensions matching root jest config
- [x] T005 [P] Define `EmailerEvent` TypeScript interface in `lambdas/emailer/src/types/emailerEvent.ts` — `{ email: string; messageObject: { bucket: string; object: string } }`
- [x] T006 [P] Define `EmailContent` TypeScript interface in `lambdas/emailer/src/types/emailContent.ts` — `{ subject: string; message: string }`
- [x] T007 Create `lambdas/emailer/src/utils/logger.ts` — lightweight logger (console.info / console.error wrapper) compatible with CloudWatch Logs output format

**Checkpoint**: Foundation ready — US1 and US2 implementation can now proceed.

---

## Phase 3: User Story 1 — Email delivered on new pending record (Priority: P1) 🎯 MVP

**Goal**: Lambda receives an EventBridge payload, resolves S3 content, and sends a transactional email to the invitee.

**Independent Test**: Invoke the Lambda handler directly with a mock `EmailerEvent`. Assert that `S3Client.send` is called with the correct bucket/object, `SESClient.send` is called with the resolved subject/message, and no errors are thrown.

- [x] T008 [US1] Implement S3 content resolver in `lambdas/emailer/src/services/contentResolver.ts` — `resolveContent(messageObject: { bucket: string; object: string }): Promise<EmailContent>` — calls `S3Client.send(new GetObjectCommand(...))`, parses response body as JSON, returns `{ subject, message }`; wraps S3 call in `try/catch`, logs error with context, re-throws

- [x] T009 [US1] Implement email sender in `lambdas/emailer/src/services/emailSender.ts` — `sendEmail(to: string, subject: string, message: string): Promise<void>` — calls `SESClient.send(new SendEmailCommand(...))` with the resolved content; wraps in `try/catch`, logs error with context, re-throws

- [x] T010 [US1] Implement Lambda handler in `lambdas/emailer/src/handler.ts` — `export const handler = async (event: EmailerEvent): Promise<void>` — calls `resolveContent(event.messageObject)` then `sendEmail(event.email, content.subject, content.message)`; wraps full flow in `try/catch`, logs success and failure via logger

- [x] T011 [P] [US1] Unit test for `contentResolver` in `lambdas/emailer/tests/unit/test_contentResolver.ts` — mock `@aws-sdk/client-s3`; assert `GetObjectCommand` is called with correct `Bucket` and `Key`; assert returned `EmailContent` matches the mocked S3 JSON body

- [x] T012 [P] [US1] Unit test for `emailSender` in `lambdas/emailer/tests/unit/test_emailSender.ts` — mock `@aws-sdk/client-ses`; assert `SendEmailCommand` is called with correct `To`, `Subject`, and `Body`; assert no errors thrown on success

- [x] T013 [P] [US1] Unit test for `handler` in `lambdas/emailer/tests/unit/test_handler.ts` — mock `contentResolver` and `emailSender` services; assert handler calls both with correct arguments on a valid `EmailerEvent`

**Checkpoint**: US1 complete — handler can be invoked with a valid event and sends email end-to-end.

---

## Phase 4: User Story 2 — Email content resolved from S3 at runtime (Priority: P2)

**Goal**: S3 content resolution is robust — input validation, missing objects, and malformed JSON are all handled and logged without crashing the Lambda.

**Independent Test**: Invoke the handler (or call `contentResolver` directly) with scenarios where S3 returns an error, returns non-JSON, or the event payload is missing fields. Assert that each failure is logged and a descriptive error is thrown (not swallowed).

- [x] T014 [US2] Add input validation to `lambdas/emailer/src/handler.ts` — before calling `resolveContent`, validate that `event.email` is a non-empty string and `event.messageObject.bucket` / `event.messageObject.object` are non-empty strings; log a descriptive error and throw if invalid

- [x] T015 [US2] Add malformed-JSON error handling to `lambdas/emailer/src/services/contentResolver.ts` — wrap `JSON.parse` in `try/catch`; if parse fails, log the raw response excerpt and throw a descriptive `Error('EmailContent JSON parse failed: ...')`

- [x] T016 [P] [US2] Unit tests for error scenarios in `lambdas/emailer/tests/unit/test_errorHandling.ts`:
  - Mock S3 send to reject → assert `contentResolver` logs error and re-throws
  - Mock S3 send to return malformed JSON body → assert `contentResolver` logs parse error and throws
  - Mock handler with missing `email` field → assert handler logs validation error and throws
  - Mock SES send to reject → assert `emailSender` logs error and re-throws

**Checkpoint**: US2 complete — all error paths are handled, logged, and testable independently.

---

## Phase 5: Infrastructure (Terraform)

**Purpose**: Provision the Lambda function, EventBridge rule, and IAM role via Terraform. No application code changes.

> Adjust paths below if Terraform lives in a separate repository.

- [x] T017 [P] Create Terraform Lambda resource in `terraform/modules/emailer-lambda/main.tf` — `aws_lambda_function` resource named `secret-santa-emailer`; runtime `nodejs22.x`; handler `handler.handler`; source from `lambdas/emailer/dist/` zip artifact; attach IAM role from T018

- [x] T018 [P] Create Terraform IAM role and policies in `terraform/modules/emailer-lambda/iam.tf` — `aws_iam_role` for the Lambda; inline policies granting `s3:GetObject` on the message-content bucket (placeholder ARN), `ses:SendEmail`, and `logs:CreateLogGroup` / `logs:CreateLogStream` / `logs:PutLogEvents`

- [x] T019 Create Terraform EventBridge rule in `terraform/modules/emailer-lambda/eventbridge.tf`:
  - `aws_cloudwatch_event_rule` named `secret-santa-new-invitation-record`
  - Event pattern targeting DynamoDB Streams / EventBridge Pipes for the Invitations table
  - Filter: `eventName = INSERT` AND `dynamodb.NewImage.status.S = "pending"`
  - `aws_cloudwatch_event_target` invoking the Lambda from T017
  - `aws_lambda_permission` granting EventBridge permission to invoke the Lambda

- [x] T020 [P] Create Terraform variables file `terraform/modules/emailer-lambda/variables.tf` — variables for: `environment`, `invitations_table_stream_arn`, `message_content_bucket_arn`, `message_content_bucket` (placeholder), `message_content_object` (placeholder)

- [x] T021 [P] Create Terraform outputs file `terraform/modules/emailer-lambda/outputs.tf` — output `lambda_function_arn` and `eventbridge_rule_arn`

---

## Final Phase: Polish & Cross-Cutting Concerns

- [x] T022 Add build script to `lambdas/emailer/package.json` — `"build": "tsc"`, `"test": "jest --coverage"`, `"package": "npm run build && zip -r emailer.zip dist/ node_modules/"` for producing the deployable Lambda artifact
- [x] T023 [P] Create `lambdas/emailer/README.md` — document purpose, local build steps (`npm install && npm run build`), test steps (`npm test`), event payload format, S3 content object schema, and placeholder values to replace before deployment
- [x] T024 Run `npm run build` in `lambdas/emailer/` and confirm TypeScript compiles to `lambdas/emailer/dist/` without errors
- [x] T025 Run `npm test` in `lambdas/emailer/` and confirm all unit tests pass with ≥ 90% coverage per constitution requirement

---

## Dependencies (User Story Completion Order)

```
Phase 1 (Setup)
  └── Phase 2 (Foundational)
        ├── Phase 3 (US1: core happy path)  ← MVP
        │     └── Phase 4 (US2: error handling & validation)
        └── Phase 5 (Terraform: infrastructure)  ← can start in parallel with US1 after Phase 2
              └── Final Phase (Polish)
```

## Parallel Execution Examples

**After T003 (tsconfig created)**:
- T005 and T006 (type definitions) can run in parallel

**After T007 (logger ready)**:
- T008 (contentResolver) and T009 (emailSender) can be started in parallel

**After T010 (handler ready)**:
- T011, T012, T013 (unit tests) can all run in parallel

**After T013 (US1 complete)**:
- T014, T015 (US2 implementation) and T017, T018 (Terraform) can proceed in parallel

## Implementation Strategy

**MVP**: Complete Phase 1 → Phase 2 → Phase 3 (US1). This delivers a deployable Lambda that
responds to EventBridge events and sends emails using S3-resolved content.

**Full delivery**: Add Phase 4 (US2 error hardening) + Phase 5 (Terraform) + Final Phase.

**Placeholder values** (replace before production deployment):
- `messageObject.bucket` → `"PLACEHOLDER_BUCKET"`
- `messageObject.object` → `"PLACEHOLDER_OBJECT_KEY"`
- Terraform `message_content_bucket_arn` / `message_content_object` variables
