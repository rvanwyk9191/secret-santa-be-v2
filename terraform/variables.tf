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

variable "ses_from_address" {
  description = "Verified SES sender email address"
  type        = string
  default     = "rvanwyk9191@gmail.com"
}

variable "invitation_base_url" {
  description = "Base URL prepended to invitation acceptance links in emails (e.g. https://api.example.com/api)"
  type        = string
  default     = "https://127.0.0.1:8080/api"
}

variable "vpc_id" {
  description = "Existing VPC containing the public subnet for the application instance"
  type        = string
}

variable "public_subnet_id" {
  description = "Existing public subnet with an Internet Gateway route"
  type        = string
}

variable "ec2_ami_id" {
  description = "Reviewed Canonical Ubuntu 24.04 LTS amd64 AMI ID for the selected region"
  type        = string
  validation {
    condition     = can(regex("^ami-[0-9a-f]+$", var.ec2_ami_id))
    error_message = "ec2_ami_id must be a reviewed AMI ID."
  }
}

variable "public_hostname" {
  description = "Public hostname served by the application instance"
  type        = string
  default     = "secretsanta.reinhardtvanwyk.com"
}

variable "manage_dns" {
  description = "Whether Terraform owns the public A record; import any existing record before enabling"
  type        = bool
  default     = false
}

variable "route53_zone_id" {
  description = "Existing public Route 53 hosted zone ID, required only when manage_dns is true"
  type        = string
  default     = null
  nullable    = true
}

variable "auth0_kms_key_arn" {
  description = "Optional customer-managed KMS key ARN used to encrypt the Auth0 client_secret parameter"
  type        = string
  default     = null
  nullable    = true
}

variable "sns_topic_arn" {
  description = "Optional existing SNS topic used by the application for notifications"
  type        = string
  default     = null
  nullable    = true
}

variable "github_repository" {
  description = "GitHub OWNER/REPOSITORY allowed to assume the production deployment role"
  type        = string
  default     = "rvanwyk9191/secret-santa-be-v2"
  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.github_repository))
    error_message = "github_repository must use OWNER/REPOSITORY format."
  }
}
