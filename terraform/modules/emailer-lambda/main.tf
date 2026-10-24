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

  runtime = "nodejs24.x"
  handler = "dist/handler.handler"

  filename         = var.lambda_artifact_path
  source_code_hash = filebase64sha256(var.lambda_artifact_path)

  role = aws_iam_role.emailer_lambda.arn

  timeout     = 30
  memory_size = 256

  environment {
    variables = {
      AWS_REGION_OVERRIDE = var.aws_region
      SES_FROM_ADDRESS    = var.ses_from_address
      PARTIES_TABLE_NAME  = var.parties_table_name
      INVITATION_BASE_URL = var.invitation_base_url
      LOG_LEVEL           = "DEBUG"
    }
  }

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_lambda_function_event_invoke_config" "emailer" {
  function_name          = aws_lambda_function.emailer.function_name
  maximum_retry_attempts = 0
}
