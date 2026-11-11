# secret-santa-v2 Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-11-05

## Active Technologies
- Bash, Node 25.8.2 (existing mandate; non-LTS/EOL risk recorded), locked TypeScript 6.0.x, Terraform 1.14.8 + Ubuntu 24.04 LTS amd64, Nginx, certbot, systemd, OpenSSL, npm, tsx, concurrently, Vite, Express, AWS SDK v3, AWS CLI v2, GitHub Actions OIDC, S3 artifacts, SSM Run Command (006-single-ec2-deployment)
- Existing DynamoDB tables; Auth0 parameters in SSM; encrypted 16 GiB gp3 root disk; 2 GiB swap (006-single-ec2-deployment)

- Bash, Node 25.8.2 (existing mandate; non-LTS/EOL risk recorded), locked TypeScript 6.0.x, Terraform 1.14.8 + Ubuntu 24.04 LTS amd64, Nginx, certbot, systemd, OpenSSL, npm, tsx, concurrently, Vite, Express, AWS SDK v3 (006-single-ec2-deployment)

## Project Structure

```text
backend/src/
frontend/src/
terraform/
lambdas/
tests/
```

## Commands

- `npm test`
- `npm run build`
- `npm run start` starts both applications from the repository root.
- `bash -n terraform/scripts/bootstrap-ec2.sh` validates installer syntax without running it.

## Code Style

Bash, Node 25.8.2 (existing mandate; non-LTS/EOL risk recorded), locked TypeScript 6.0.x, Terraform 1.14.8: Follow standard conventions

## Recent Changes
- 006-single-ec2-deployment: Added Bash, Node 25.8.2 (existing mandate; non-LTS/EOL risk recorded), locked TypeScript 6.0.x, Terraform 1.14.8 + Ubuntu 24.04 LTS amd64, Nginx, certbot, systemd, OpenSSL, npm, tsx, concurrently, Vite, Express, AWS SDK v3, AWS CLI v2, GitHub Actions OIDC, S3 artifacts, SSM Run Command

- 006-single-ec2-deployment: Added Bash, Node 25.8.2 (existing mandate; non-LTS/EOL risk recorded), locked TypeScript 6.0.x, Terraform 1.14.8 + Ubuntu 24.04 LTS amd64, Nginx, certbot, systemd, OpenSSL, npm, tsx, concurrently, Vite, Express, AWS SDK v3

<!-- MANUAL ADDITIONS START -->
Deployment design lives in `specs/006-single-ec2-deployment/`. Use one Ubuntu 24.04 amd64 `t3.micro`, an Elastic IP, Nginx HTTPS and `secretsanta.reinhardtvanwyk.com`; this profile supersedes earlier ECS/ALB assumptions. Existing DynamoDB access uses the EC2 instance profile, never static keys. Terraform compute resources and bootstrap delivery are implemented but not applied to AWS. Never run the privileged installer on the macOS workstation.
<!-- MANUAL ADDITIONS END -->
