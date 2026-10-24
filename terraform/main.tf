# Terraform main configuration for Secret Santa Party Management

terraform {
  required_version = ">= 1.3.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }

  # Remote state — run `cd terraform/bootstrap && terraform apply` first to create
  # the bucket and lock table, then `terraform init -migrate-state` here to migrate.
  backend "s3" {
    bucket         = "secret-santa-rvw-tfstate"
    key            = "secret-santa-v2/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "secret-santa-tfstate-lock"
  }
}

provider "aws" {
  region = var.aws_region
}

# DynamoDB tables, ECS, and other resources will be defined here.

# ---------------------------------------------------------------------------
# Emailer Lambda module
# ---------------------------------------------------------------------------
module "emailer_lambda" {
  source = "./modules/emailer-lambda"

  environment                  = var.environment
  aws_region                   = var.aws_region
  invitations_table_stream_arn = aws_dynamodb_table.invitations.stream_arn
  message_content_bucket_arn   = aws_s3_bucket.email_content.arn
  message_content_bucket       = aws_s3_bucket.email_content.bucket
  message_content_object       = "invitation.json"
  ses_from_address             = var.ses_from_address
  lambda_artifact_path         = "../lambdas/emailer/emailer.zip"
  parties_table_arn            = aws_dynamodb_table.parties.arn
  parties_table_name           = "Parties"
  invitation_base_url          = var.invitation_base_url
}

# Parties Table
resource "aws_dynamodb_table" "parties" {
  name           = "Parties"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "party_id"
  attribute {
    name = "party_id"
    type = "S"
  }
}

# PartyMembers Table
resource "aws_dynamodb_table" "party_members" {
  name           = "PartyMembers"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "email"
  range_key      = "party_id"
  attribute {
    name = "email"
    type = "S"
  }
  attribute {
    name = "party_id"
    type = "S"
  }

  # GSI used by assignmentService to query all members by party_id
  global_secondary_index {
    name            = "party_id-index"
    hash_key        = "party_id"
    projection_type = "ALL"
  }
}

# Invitations Table
resource "aws_dynamodb_table" "invitations" {
  name           = "Invitations"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "party_id"
  range_key      = "email"

  # Streams required for EventBridge Pipe (emailer Lambda trigger)
  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  attribute {
    name = "party_id"
    type = "S"
  }
  attribute {
    name = "email"
    type = "S"
  }
}

# Assignments Table
resource "aws_dynamodb_table" "assignments" {
  name           = "Assignments"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "party_id"
  range_key      = "giver_email"
  attribute {
    name = "party_id"
    type = "S"
  }
  attribute {
    name = "giver_email"
    type = "S"
  }
}

# NotificationEvents Table
resource "aws_dynamodb_table" "notification_events" {
  name           = "NotificationEvents"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "party_id"
  range_key      = "created_at"
  attribute {
    name = "party_id"
    type = "S"
  }
  attribute {
    name = "created_at"
    type = "S"
  }
}
