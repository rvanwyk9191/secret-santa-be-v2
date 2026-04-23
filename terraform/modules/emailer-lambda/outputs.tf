output "lambda_function_arn" {
  description = "ARN of the emailer Lambda function"
  value       = aws_lambda_function.emailer.arn
}

output "eventbridge_rule_arn" {
  description = "ARN of the EventBridge Pipe (secret-santa-new-invitation-record)"
  value       = aws_pipes_pipe.emailer.arn
}
