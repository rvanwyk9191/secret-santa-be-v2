variable "environment" {
  description = "Deployment environment (e.g. dev, prod)"
  type        = string
}

variable "aws_region" {
  description = "AWS region where resources are deployed"
  type        = string
  default     = "us-east-1"
}

variable "invitations_table_stream_arn" {
  description = "ARN of the DynamoDB Stream on the Invitations table"
  type        = string
}

variable "message_content_bucket_arn" {
  description = "ARN of the S3 bucket that holds email content objects"
  type        = string
}

variable "message_content_bucket" {
  description = "Name of the S3 bucket that holds email content objects (placeholder — update before deployment)"
  type        = string
  default     = "PLACEHOLDER_BUCKET"
}

variable "message_content_object" {
  description = "S3 object key for the invitation email content JSON (placeholder — update before deployment)"
  type        = string
  default     = "PLACEHOLDER_OBJECT_KEY"
}

variable "ses_from_address" {
  description = "Email address used as the SES sender (must be verified in SES)"
  type        = string
  default     = "noreply@example.com"
}

variable "lambda_artifact_path" {
  description = "Absolute or root-relative path to the Lambda deployment zip artifact"
  type        = string
  default     = "../lambdas/emailer/emailer.zip"
}

variable "parties_table_arn" {
  description = "ARN of the DynamoDB Parties table (used for GetItem permission on the Lambda role)"
  type        = string
}

variable "parties_table_name" {
  description = "Name of the DynamoDB Parties table passed to the Lambda as an environment variable"
  type        = string
  default     = "Parties"
}

variable "invitation_base_url" {
  description = "Base URL prepended to invitation acceptance links included in invitation emails (e.g. https://api.example.com/api)"
  type        = string
  default     = "https://127.0.0.1:8080/api"
}
