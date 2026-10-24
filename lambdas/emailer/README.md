# secret-santa-emailer

Lambda function that sends invitation emails for Secret Santa parties. Triggered by EventBridge Pipes when a new `pending` Invitation record is inserted into the DynamoDB Invitations table.

---

## Architecture

```
DynamoDB Invitations stream
  └─► EventBridge Pipe (secret-santa-new-invitation-record)
        │  Filter: eventName=INSERT AND NewImage.status.S="pending"
        └─► Lambda: secret-santa-emailer
              ├── Fetch email content JSON from S3
              └── Send transactional email via SES
```

---

## Event Payload

The EventBridge Pipe transforms the DynamoDB stream record into the following payload before invoking the Lambda:

```json
{
  "email": "invitee@example.com",
  "messageObject": {
    "bucket": "<message-content-bucket-name>",
    "object": "<path/to/invite-content.json>"
  }
}
```

---

## S3 Content Object Schema

The S3 object referenced by `messageObject` must be a valid JSON file with the following shape:

```json
{
  "subject": "You have been invited to a Secret Santa party!",
  "message": "Hi! You've been invited to join a Secret Santa party. Click here to accept."
}
```

Both `subject` and `message` are required string fields. The Lambda will throw `EmailContent JSON parse failed` if the object is missing, malformed, or does not match this schema.

---

## Local Development

### Prerequisites

- Node.js 22 (`nvm use 22`)
- AWS credentials configured (for integration testing against real AWS resources)

### Install dependencies

```sh
cd lambdas/emailer
nvm use 22
npm install --ignore-scripts
```

### Build

Compiles TypeScript source from `src/` to `dist/`:

```sh
npm run build
```

Output is written to `lambdas/emailer/dist/`.

### Test

Runs all unit tests with coverage reporting (≥ 90% required per constitution):

```sh
npm test
```

### Package for deployment

Produces `emailer.zip` containing the compiled `dist/` and `node_modules/`:

```sh
npm run package
```

The resulting `emailer.zip` is the artifact referenced by the Terraform `aws_lambda_function` resource (`lambda_artifact_path`).

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `SES_FROM_ADDRESS` | Yes (for real sends) | `noreply@example.com` | SES-verified sender address |
| `AWS_REGION` | No | `us-east-1` | AWS region for S3 and SES clients |

---

## Placeholder Values to Replace Before Deployment

The following placeholders appear in Terraform variables and must be replaced with real values:

| Placeholder | Where | Description |
|---|---|---|
| `PLACEHOLDER_BUCKET` | `terraform/variables.tf` → `message_content_bucket` | S3 bucket name holding email content JSON |
| `PLACEHOLDER_BUCKET_ARN` | `terraform/variables.tf` → `message_content_bucket_arn` | ARN of the S3 bucket (for IAM policy) |
| `PLACEHOLDER_OBJECT_KEY` | `terraform/variables.tf` → `message_content_object` | S3 object key for the invitation content JSON |
| `noreply@example.com` | `terraform/variables.tf` → `ses_from_address` | SES-verified sender email address |

---

## Terraform

The Lambda, IAM roles, and EventBridge Pipe are managed in:

```
terraform/modules/emailer-lambda/
├── main.tf         # aws_lambda_function
├── iam.tf          # execution role + pipe role + policies
├── eventbridge.tf  # aws_pipes_pipe + aws_lambda_permission
├── variables.tf    # all input variables
└── outputs.tf      # lambda_function_arn, eventbridge_rule_arn
```

The module is instantiated from `terraform/main.tf` and receives `invitations_table_stream_arn` directly from the `aws_dynamodb_table.invitations` resource.
