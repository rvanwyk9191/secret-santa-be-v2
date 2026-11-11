output "instance_id" {
  description = "EC2 instance ID for the application host"
  value       = aws_instance.application.id
}

output "elastic_ip" {
  description = "Stable public IPv4 address associated with the application host"
  value       = aws_eip.application.public_ip
}

output "application_url" {
  description = "Public application URL"
  value       = "https://${var.public_hostname}"
}

output "deployment_bucket" {
  description = "Private S3 bucket for immutable application release artifacts"
  value       = aws_s3_bucket.deployment_artifacts.bucket
}

output "github_deployment_role_arn" {
  description = "OIDC role ARN to configure as the GitHub production environment AWS_ROLE_ARN variable"
  value       = aws_iam_role.github_deploy.arn
}