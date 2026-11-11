data "aws_caller_identity" "current" {}

data "aws_partition" "current" {}

data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

data "aws_subnet" "application" {
  id = var.public_subnet_id
}

locals {
  app_table_arns = [
    aws_dynamodb_table.parties.arn,
    aws_dynamodb_table.party_members.arn,
    aws_dynamodb_table.invitations.arn,
    aws_dynamodb_table.assignments.arn,
    aws_dynamodb_table.notification_events.arn,
  ]
  app_query_scan_arns = concat(local.app_table_arns, [
    "${aws_dynamodb_table.party_members.arn}/index/party_id-index",
  ])
  auth0_parameter_arns = [
    for name in ["domain", "audience", "client_id", "client_secret"] :
    "arn:${data.aws_partition.current.partition}:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/secret-santa/auth0/${name}"
  ]
  artifact_bucket_name = "secret-santa-${data.aws_caller_identity.current.account_id}-deploy-releases"
  user_data_commands = concat(
    [
      "if ! command -v snap >/dev/null 2>&1; then apt-get update && apt-get install -y snapd; fi",
      "snap list amazon-ssm-agent >/dev/null 2>&1 || snap install amazon-ssm-agent --classic",
      "systemctl enable --now snap.amazon-ssm-agent.amazon-ssm-agent.service",
      "AWS_REGION=${var.aws_region} bash /usr/local/sbin/secret-santa-bootstrap-ec2.sh install",
    ],
    var.sns_topic_arn == null ? [] : [
      "printf '\\nSNS_TOPIC_ARN=%s\\n' ${jsonencode(var.sns_topic_arn)} >> /etc/secret-santa/app.env && chown root:secret-santa /etc/secret-santa/app.env && chmod 0640 /etc/secret-santa/app.env",
    ]
  )
}

resource "aws_security_group" "application" {
  name        = "secret-santa-app-${var.environment}"
  description = "Public web ingress for Secret Santa; administration uses SSM"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTP for ACME challenges and HTTPS redirect"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Public HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "HTTPS APIs, package repositories, and certificate endpoints"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "HTTP package repositories and ACME HTTP validation"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "DNS lookups"
    from_port   = 53
    to_port     = 53
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "TCP DNS lookups"
    from_port   = 53
    to_port     = 53
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "secret-santa-app-${var.environment}"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_iam_role" "application" {
  name = "secret-santa-app-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_iam_instance_profile" "application" {
  name = "secret-santa-app-${var.environment}"
  role = aws_iam_role.application.name
}

resource "aws_iam_role_policy_attachment" "application_ssm" {
  role       = aws_iam_role.application.name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

data "aws_iam_policy_document" "application" {
  statement {
    sid       = "ApplicationTableOperations"
    effect    = "Allow"
    actions   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem"]
    resources = local.app_table_arns
  }

  statement {
    sid       = "ApplicationTableQueries"
    effect    = "Allow"
    actions   = ["dynamodb:Query", "dynamodb:Scan"]
    resources = local.app_query_scan_arns
  }

  statement {
    sid       = "ReadAuth0Parameters"
    effect    = "Allow"
    actions   = ["ssm:GetParameter"]
    resources = local.auth0_parameter_arns
  }

  dynamic "statement" {
    for_each = var.auth0_kms_key_arn == null ? [] : [var.auth0_kms_key_arn]
    content {
      sid       = "DecryptAuth0ClientSecret"
      effect    = "Allow"
      actions   = ["kms:Decrypt"]
      resources = [statement.value]

      condition {
        test     = "StringEquals"
        variable = "kms:ViaService"
        values   = ["ssm.${var.aws_region}.amazonaws.com"]
      }

      condition {
        test     = "StringEquals"
        variable = "kms:EncryptionContext:PARAMETER_ARN"
        values   = [local.auth0_parameter_arns[3]]
      }
    }
  }

  dynamic "statement" {
    for_each = var.sns_topic_arn == null ? [] : [var.sns_topic_arn]
    content {
      sid       = "PublishApplicationNotifications"
      effect    = "Allow"
      actions   = ["sns:Publish"]
      resources = [statement.value]
    }
  }

  statement {
    sid       = "ReadReleaseArtifacts"
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.deployment_artifacts.arn}/releases/*"]
  }
}

resource "aws_iam_role_policy" "application" {
  name   = "secret-santa-app-${var.environment}"
  role   = aws_iam_role.application.id
  policy = data.aws_iam_policy_document.application.json
}

resource "aws_iam_role" "github_deploy" {
  name = "secret-santa-github-deploy-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = data.aws_iam_openid_connect_provider.github.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_repository}:environment:production"
        }
      }
    }]
  })

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

data "aws_iam_policy_document" "github_deploy" {
  statement {
    sid       = "UploadReleaseArtifacts"
    effect    = "Allow"
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.deployment_artifacts.arn}/releases/*"]
  }

  statement {
    sid     = "RunReleaseOnApplicationInstance"
    effect  = "Allow"
    actions = ["ssm:SendCommand"]
    resources = [
      "arn:${data.aws_partition.current.partition}:ec2:${var.aws_region}:${data.aws_caller_identity.current.account_id}:instance/${aws_instance.application.id}",
      "arn:${data.aws_partition.current.partition}:ssm:${var.aws_region}::document/AWS-RunShellScript",
    ]
  }

  statement {
    sid       = "ReadDeploymentCommandResult"
    effect    = "Allow"
    actions   = ["ssm:GetCommandInvocation"]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "github_deploy" {
  name   = "secret-santa-github-deploy-${var.environment}"
  role   = aws_iam_role.github_deploy.id
  policy = data.aws_iam_policy_document.github_deploy.json
}

resource "aws_s3_bucket" "deployment_artifacts" {
  bucket        = local.artifact_bucket_name
  force_destroy = false

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_s3_bucket_public_access_block" "deployment_artifacts" {
  bucket = aws_s3_bucket.deployment_artifacts.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "deployment_artifacts" {
  bucket = aws_s3_bucket.deployment_artifacts.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "deployment_artifacts" {
  bucket = aws_s3_bucket.deployment_artifacts.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "deployment_artifacts" {
  bucket = aws_s3_bucket.deployment_artifacts.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "deployment_artifacts" {
  bucket = aws_s3_bucket.deployment_artifacts.id

  rule {
    id     = "expire-deployment-releases"
    status = "Enabled"

    filter {
      prefix = "releases/"
    }

    expiration {
      days = 90
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

data "aws_iam_policy_document" "deployment_artifacts" {
  statement {
    sid     = "DenyInsecureTransport"
    effect  = "Deny"
    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.deployment_artifacts.arn,
      "${aws_s3_bucket.deployment_artifacts.arn}/*",
    ]

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "deployment_artifacts" {
  bucket = aws_s3_bucket.deployment_artifacts.id
  policy = data.aws_iam_policy_document.deployment_artifacts.json
}

resource "aws_instance" "application" {
  ami                         = var.ec2_ami_id
  instance_type               = "t3.micro"
  subnet_id                   = var.public_subnet_id
  vpc_security_group_ids      = [aws_security_group.application.id]
  iam_instance_profile        = aws_iam_instance_profile.application.name
  associate_public_ip_address = true

  user_data = <<-USERDATA
    #cloud-config
    write_files:
      - path: /usr/local/sbin/secret-santa-bootstrap-ec2.sh
        owner: root:root
        permissions: '0755'
        encoding: b64
        content: ${filebase64("${path.module}/scripts/bootstrap-ec2.sh")}
    runcmd:
    ${join("\n", [for command in local.user_data_commands : "  - [ bash, -c, ${jsonencode(command)} ]"])}
  USERDATA

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
    instance_metadata_tags      = "disabled"
  }

  root_block_device {
    volume_type           = "gp3"
    volume_size           = 16
    encrypted             = true
    delete_on_termination = true
  }

  lifecycle {
    precondition {
      condition     = data.aws_subnet.application.vpc_id == var.vpc_id
      error_message = "public_subnet_id must belong to vpc_id."
    }
  }

  depends_on = [
    aws_iam_role_policy.application,
    aws_iam_role_policy_attachment.application_ssm,
  ]

  tags = {
    Name        = "secret-santa-app-${var.environment}"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_eip" "application" {
  domain = "vpc"

  tags = {
    Name        = "secret-santa-app-${var.environment}"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_eip_association" "application" {
  allocation_id = aws_eip.application.id
  instance_id   = aws_instance.application.id
}

resource "aws_route53_record" "application" {
  count = var.manage_dns ? 1 : 0

  zone_id         = var.route53_zone_id
  name            = var.public_hostname
  type            = "A"
  ttl             = 300
  records         = [aws_eip.application.public_ip]
  allow_overwrite = false

  lifecycle {
    precondition {
      condition     = var.route53_zone_id != null && var.route53_zone_id != ""
      error_message = "route53_zone_id is required when manage_dns is true."
    }
  }
}