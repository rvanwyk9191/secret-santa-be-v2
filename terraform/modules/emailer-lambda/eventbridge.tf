# ---------------------------------------------------------------------------
# EventBridge Pipe — DynamoDB Streams → Lambda
# Rule name: secret-santa-new-invitation-record
# Filter: eventName = INSERT AND NewImage.status.S = "pending"
# ---------------------------------------------------------------------------
resource "aws_pipes_pipe" "emailer" {
  name     = "secret-santa-new-invitation-record"
  role_arn = aws_iam_role.emailer_pipe.arn

  source = var.invitations_table_stream_arn

  source_parameters {
    dynamodb_stream_parameters {
      batch_size        = 1
      starting_position = "LATEST"
    }

    filter_criteria {
      filter {
        pattern = jsonencode({
          eventName = ["INSERT"]
          dynamodb = {
            NewImage = {
              status = { S = ["pending"] }
            }
          }
        })
      }
    }
  }

  target = aws_lambda_function.emailer.arn

  target_parameters {
    # Shape the DynamoDB stream record into the EmailerEvent payload expected by the Lambda.
    # Angle-bracket paths (<$.…>) are EventBridge Pipes dynamic path syntax — not Terraform
    # interpolation. The bucket and object are static placeholders resolved at deploy time.
    input_template = "{\"email\": \"<$.dynamodb.NewImage.email.S>\", \"messageObject\": {\"bucket\": \"${var.message_content_bucket}\", \"object\": \"${var.message_content_object}\"}}"
  }

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Allow EventBridge Pipes service to invoke the Lambda function
resource "aws_lambda_permission" "eventbridge_pipe" {
  statement_id  = "AllowEventBridgePipeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.emailer.function_name
  principal     = "pipes.amazonaws.com"
  source_arn    = aws_pipes_pipe.emailer.arn
}
