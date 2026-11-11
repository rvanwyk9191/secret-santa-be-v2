# Implementation Plan: Single-EC2 Deployment

**Branch**: `002-party-management-init` | **Date**: 2026-11-05 | **Spec**: [spec.md](spec.md)
**Feature**: `006-single-ec2-deployment`; no branch was created or changed.
**Input**: `/Users/rvanwyk/code/secret-santa-v2/secret-santa-v2/specs/006-single-ec2-deployment/spec.md`

**Status**: Terraform compute, IAM, artifact storage, optional DNS, bootstrap delivery, and CI role are implemented locally and validated. AWS resources have not been applied; live deployment remains pending.

## Summary

Deploy frontend and backend together on one Ubuntu 24.04 amd64 EC2 `t3.micro`. An Elastic IP provides the stable target for the existing Route 53 name `secretsanta.reinhardtvanwyk.com`. Nginx serves browser-trusted HTTPS and proxies to the existing Vite frontend and its `/api` backend proxy. An instance profile grants least-privilege DynamoDB, SSM and applicable SNS access without static keys. Existing databases and the emailer Lambda remain separate.

The bootstrap prepares the instance and runs the existing `npm run start` through systemd. GitHub Actions validates changes, packages the exact main commit, assumes a repository-scoped OIDC role created by Terraform, and deploys an encrypted S3 release through SSM. The release helper preserves/restores the previous checkout if installation or internal health fails. Terraform provisions the infrastructure when applied; no AWS resources were applied during this implementation.

## Technical Context

**Language/Version**: Bash, Node 25.8.2 (existing mandate; non-LTS/EOL risk recorded), locked TypeScript 6.0.x, Terraform 1.14.8
**Primary Dependencies**: Ubuntu 24.04 LTS amd64, Nginx, certbot, systemd, OpenSSL, npm, tsx, concurrently, Vite, Express, AWS SDK v3, AWS CLI v2, GitHub Actions OIDC, S3 artifacts, SSM Run Command
**Storage**: Existing DynamoDB tables; Auth0 parameters in SSM; encrypted 16 GiB gp3 root disk; 2 GiB swap
**Testing**: Bash syntax/CLI guard checks; scoped Terraform fmt/validate; reviewed AWS plan and gated live DNS/TLS/IAM/Auth0/reboot checks remain pending
**Target Platform**: One AWS EC2 `t3.micro` (2 burstable vCPUs, 1 GiB RAM), existing public subnet with HTTPS egress
**Project Type**: Web application plus infrastructure/bootstrap tooling
**Performance Goals**: Existing small private gift-exchange workload; verify health and responsiveness rather than claiming 100 requests/second
**Constraints**: One app instance; public 80/443 only; IMDSv2; no ALB/ECS/NAT gateway; no static AWS keys; preserve manually created DNS until explicit migration
**Scale/Scope**: Co-located frontend/backend; existing DynamoDB/SSM/SNS/Lambda retained; accepted single point of failure and deployment downtime

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated before research and after design against constitution 1.16. The user-requested single-EC2 profile is explicitly documented there rather than silently violating ECS/ALB rules.

| Principle | Design Gate | Result |
|-----------|-------------|--------|
| AWS/domain boundaries | One t3.micro; retain logical domains; scoped ECS/ALB exception | PASS |
| HTTPS | Nginx TLS and redirect except ACME; existing TLS upstreams retained | PASS |
| DynamoDB/Auth0 | Instance profile, exact SSM paths, no credential fallback | PASS |
| Runtime/build | npm start exception; CI builds/tests; dev dependencies included | PASS |
| Terraform | New AWS resources managed in existing project/S3 state | PASS; local validation complete, AWS plan/application pending |
| Security | Encrypted disk, IMDSv2, restricted ingress, non-root service, persistent secret | PASS design; live checks required |
| Event-driven apps | Emailer remains separately packaged Lambda | PASS |
| Testing/observability | Offline checks; journald and public health smoke checks | PASS design; live checks pending |

No unresolved design clarifications. Region, VPC/subnet IDs, AMI ID, hosted-zone ID, applicable KMS key, ACME email and reviewed release are deployment inputs. Node lifecycle risk and Vite development-server exposure are recorded limitations, not claims of production hardening.

## Project Structure

### Documentation (this feature)

```text
specs/006-single-ec2-deployment/
  spec.md
  plan.md
  research.md
  data-model.md
  quickstart.md
  contracts/deployment.md
```

### Source Code (repository root)
```text
terraform/
  main.tf                    existing database/emailer resources
  variables.tf               existing and deployment inputs
  compute.tf                 EC2, EIP, IAM, SG, artifact storage and optional DNS ownership
  outputs.tf                 instance/IP/URL and CI configuration outputs
  scripts/bootstrap-ec2.sh    delivered install/deploy/https phases
  scripts/deploy-release.sh   delivered release switch and rollback
.github/workflows/deploy-ec2.yml
backend/src/                 unchanged application
frontend/                    unchanged application and Vite proxy
.specify/memory/constitution.md
```

**Structure Decision**: Reuse the current Terraform project/state, runtime scripts and locked dependencies. Avoid a new infrastructure project, container system or alternate start command.

## Phase 0: Research

Complete: [research.md](research.md) records compute/OS, runtime, DNS/TLS, IAM and lifecycle decisions and alternatives. Repository evidence identifies SSM/session/TLS requirements, root/frontend lockfiles, Vite host checks, DynamoDB indexes and SNS publishing.

## Phase 1: Design And Contracts

Complete: [data-model.md](data-model.md), [contracts/deployment.md](contracts/deployment.md), and [quickstart.md](quickstart.md). Bootstrap is the explicitly requested runnable design artifact. Update Copilot context using the standard script with this feature directory override. Post-design constitution gate: PASS with no unjustified violations; runtime/infrastructure acceptance remains unverified until deployed.

## Phase 2: Implementation Record

Terraform now provisions one `t3.micro`, the restricted security group, encrypted gp3 root disk, IMDSv2, SSM instance profile, Elastic IP, and cloud-init delivery of the `install` phase. Its app policy is limited to the five existing tables, four Auth0 parameters, optional topic/key, and release-object prefix; existing data resources are unchanged.

The implementation also provisions a private versioned artifact bucket with SSE-S3, public-access blocks, TLS-only policy and lifecycle retention, plus a GitHub OIDC role restricted to this repository's `production` environment. The account's `token.actions.githubusercontent.com` OIDC provider must already exist. Set the GitHub production environment variables from Terraform outputs, including `AWS_ROLE_ARN`, `DEPLOY_BUCKET`, `EC2_INSTANCE_ID`, and `AWS_REGION`.

DNS remains externally managed by default. Optional Terraform ownership uses `manage_dns = true` and `allow_overwrite = false`; import the existing A record before applying with DNS management enabled. No AWS resources were applied during implementation. DNS/TLS/Auth0 setup, reviewed release deployment, and live acceptance checks remain operator steps.

## Verification Criteria

- Local: Bash syntax, help/invalid-phase guards, required artifacts, valid local links and no unresolved design placeholders.
- Infrastructure implementation: scoped Terraform formatting and `terraform validate` pass. An AWS plan was not run because the configured backend currently requires reinitialization/migration; review an initialized plan for unrelated database/DNS changes before any authorized apply.
- Live: DNS/trusted TLS, frontend/API health, Auth0 cookies/login/logout, DynamoDB create/read and negative IAM checks, closed 22/3000/8080, reboot recovery, preserved secret on rerun and `certbot renew --dry-run`.
- Not verified locally: apt, Node download/runtime, systemd/Nginx/certbot behavior, AWS resources, DNS ownership or live authentication/data workflows. Run on the specified EC2 OS, not the macOS workstation.
- CI activation blockers found locally: backend build has a `party_date` optional-property type error; frontend build/tests have missing `pendingInvitees` fixtures and an unused import; frontend coverage currently fails its existing threshold. Keep these gates enabled and fix application issues separately before expecting an automatic deployment.

## Complexity Tracking

No unjustified violations. EC2, EBS, public IPv4, Route 53 and managed-service charges remain. CPU credits and single-host downtime are accepted constraints. Node LTS migration, static frontend serving and stronger Vite-to-backend certificate verification are separate follow-ups.
