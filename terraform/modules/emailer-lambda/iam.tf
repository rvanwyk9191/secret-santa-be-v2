# ---------------------------------------------------------------------------
# Lambda execution role
# ---------------------------------------------------------------------------
resource "aws_iam_role" "emailer_lambda" {
  name = "secret-santa-emailer-lambda-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "lambda.amazonaws.com" }
        Action    = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_iam_role_policy" "emailer_lambda" {
  name = "secret-santa-emailer-lambda-policy-${var.environment}"
  role = aws_iam_role.emailer_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "S3GetEmailContent"
        Effect   = "Allow"
        Action   = "s3:GetObject"
        Resource = "${var.message_content_bucket_arn}/*"
      },
      {
        Sid      = "SESSendEmail"
        Effect   = "Allow"
        Action   = "ses:SendEmail"
        Resource = "*"
      },
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:*:log-group:/aws/lambda/secret-santa-emailer-${var.environment}:*"
      }
    ]
  })
}

# ---------------------------------------------------------------------------
# EventBridge Pipe execution role
# ---------------------------------------------------------------------------
resource "aws_iam_role" "emailer_pipe" {
  name = "secret-santa-emailer-pipe-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "pipes.amazonaws.com" }
        Action    = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_iam_role_policy" "emailer_pipe" {
  name = "secret-santa-emailer-pipe-policy-${var.environment}"
  role = aws_iam_role.emailer_pipe.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DynamoDBStreamRead"
        Effect = "Allow"
        Action = [
          "dynamodb:GetRecords",
          "dynamodb:GetShardIterator",
          "dynamodb:DescribeStream",
          "dynamodb:ListShards",
          "dynamodb:ListStreams"
        ]
        Resource = var.invitations_table_stream_arn
      },
      {
        Sid      = "LambdaInvoke"
        Effect   = "Allow"
        Action   = "lambda:InvokeFunction"
        Resource = aws_lambda_function.emailer.arn
      }
    ]
  })
}
