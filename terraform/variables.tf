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
