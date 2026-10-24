# Terraform bootstrap — creates the remote state backend resources
#
# Run this ONCE before using the main Terraform configuration:
#
#   cd terraform/bootstrap
#   terraform init
#   terraform apply
#
# After apply completes, return to terraform/ and run:
#
#   terraform init -migrate-state   # migrates local tfstate to S3
#   terraform plan

terraform {
  required_version = ">= 1.3.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  description = "AWS region for state resources"
  type        = string
  default     = "us-east-1"
}

# ---------------------------------------------------------------------------
# S3 bucket — stores Terraform state files
# ---------------------------------------------------------------------------
resource "aws_s3_bucket" "tfstate" {
  bucket = "secret-santa-rvw-tfstate"

  # Prevent accidental deletion of the state bucket.
  lifecycle {
    prevent_destroy = true
  }

  tags = {
    ManagedBy = "terraform-bootstrap"
    Purpose   = "terraform-state"
  }
}

resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ---------------------------------------------------------------------------
# DynamoDB table — state lock (prevents concurrent applies)
# ---------------------------------------------------------------------------
resource "aws_dynamodb_table" "tfstate_lock" {
  name         = "secret-santa-tfstate-lock"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = {
    ManagedBy = "terraform-bootstrap"
    Purpose   = "terraform-state-lock"
  }
}

output "state_bucket" {
  value       = aws_s3_bucket.tfstate.bucket
  description = "S3 bucket name for Terraform state"
}

output "lock_table" {
  value       = aws_dynamodb_table.tfstate_lock.name
  description = "DynamoDB table name for Terraform state locking"
}
