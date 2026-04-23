variable "aws_region" {
  description = "AWS region to deploy resources into"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment (e.g. dev, prod)"
  type        = string
  default     = "dev"
}

variable "message_content_bucket_arn" {
  description = "ARN of the S3 bucket that holds invitation email content objects"
  type        = string
  default     = "PLACEHOLDER_BUCKET_ARN"
}

variable "message_content_bucket" {
  description = "Name of the S3 bucket that holds invitation email content objects"
  type        = string
  default     = "PLACEHOLDER_BUCKET"
}

variable "message_content_object" {
  description = "S3 object key for the invitation email content JSON"
  type        = string
  default     = "PLACEHOLDER_OBJECT_KEY"
}

variable "ses_from_address" {
  description = "Verified SES sender email address"
  type        = string
  default     = "noreply@example.com"
}
