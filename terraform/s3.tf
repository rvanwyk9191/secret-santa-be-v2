# ---------------------------------------------------------------------------
# S3 bucket for email message content templates
# ---------------------------------------------------------------------------
resource "aws_s3_bucket" "email_content" {
  bucket = "secret-santa-rvw-emails"

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_s3_bucket_public_access_block" "email_content" {
  bucket = aws_s3_bucket.email_content.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "email_content" {
  bucket = aws_s3_bucket.email_content.id

  versioning_configuration {
    status = "Enabled"
  }
}

# ---------------------------------------------------------------------------
# Email content templates
# ---------------------------------------------------------------------------
resource "aws_s3_object" "invitation_template" {
  bucket       = aws_s3_bucket.email_content.bucket
  key          = "invitation.json"
  content_type = "application/json"

  # Placeholders are resolved at runtime by the emailer Lambda using DynamoDB lookups.
  content = jsonencode({
    subject = "You've been invited to join <placeholder for the party name>"
    message = "Click on the link to join your party. <placeholder for link that directs to join the party with the party id>"
  })
}
