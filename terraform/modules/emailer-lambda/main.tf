terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

# ---------------------------------------------------------------------------
# Lambda function — secret-santa-emailer
# ---------------------------------------------------------------------------
resource "aws_lambda_function" "emailer" {
  function_name = "secret-santa-emailer-${var.environment}"
  description   = "Sends invitation emails triggered by new pending Invitation records"

  runtime = "nodejs22.x"
  handler = "handler.handler"

  filename         = var.lambda_artifact_path
  source_code_hash = filebase64sha256(var.lambda_artifact_path)

  role = aws_iam_role.emailer_lambda.arn

  timeout     = 30
  memory_size = 256

  environment {
    variables = {
      AWS_REGION_OVERRIDE = var.aws_region
      SES_FROM_ADDRESS    = var.ses_from_address
    }
  }

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}
