# Feature Specification: Single-EC2 Deployment

**Feature**: `006-single-ec2-deployment`
**Created**: 2026-11-05
**Status**: Terraform implemented; AWS resources have not been provisioned
**Working branch**: `002-party-management-init` (no branch change requested)

## User Scenarios And Testing

### User Story 1: Reach The Application (P1)

As an organizer, I can open `https://secretsanta.reinhardtvanwyk.com` and use the frontend and API served by the same `t3.micro` EC2 instance.

Acceptance: Route 53 resolves the hostname to a stable Elastic IP. The frontend returns HTML, `/api/health` returns HTTP 200 with `{"status":"ok"}`, and login/callback/logout stay on the same public origin. Ports 3000/8080 are not public. HTTP redirects to HTTPS except ACME challenges.

### User Story 2: Persist Data Securely (P1)

As an authenticated organizer, I can create and retrieve parties using the existing DynamoDB tables without storing AWS keys on the instance.

Acceptance: The SDK uses the instance profile in the configured region; permitted table/index operations work, unrelated tables are denied, and existing SSM-based Auth0 configuration loads. DynamoDB, SSM, Auth0 and package/certificate endpoints are reachable over HTTPS.

### User Story 3: Bootstrap And Restart (P1)

As an operator, I can install the required tools, stage a reviewed release and run repository-root `npm run start` as an unprivileged systemd service.

Acceptance: On Ubuntu 24.04 amd64, bootstrap provisions Node/npm, native build tools, TLS files, Nginx, certificate tooling and swap. Both lockfiles install with development dependencies. The service passes health checks, survives reboot and restarts after process failure. Rerunning installation preserves the session secret and public TLS configuration.

## Requirements

- **FR-001**: Use exactly one EC2 `t3.micro` for frontend and backend. Keep DynamoDB and the existing emailer Lambda as external managed services.
- **FR-002**: Use an existing VPC/public subnet with an Internet Gateway route, an encrypted 16 GiB gp3 root volume and IMDSv2-required metadata.
- **FR-003**: Allocate/associate an Elastic IP; output its address, instance ID and HTTPS URL. No ALB, ECS, ECR, NAT gateway or Auto Scaling Group is required.
- **FR-004**: Use an A record for `secretsanta.reinhardtvanwyk.com`. Keep existing manual DNS externally managed by default. Import before opting into Terraform record management; never use blind overwrite. Explicitly review conflicting CNAME/AAAA records.
- **FR-005**: Allow public inbound TCP 80/443 only. Use SSM Session Manager for administration and verify the AMI has a working SSM agent. Do not expose SSH or application ports.
- **FR-006**: Use an instance profile with least-privilege DynamoDB table/index actions, exact Auth0 SSM reads, conditional customer-key KMS decrypt, SSM managed-instance permissions and SNS publish only to the configured topic. Never install static AWS keys.
- **FR-007**: Supply `AWS_REGION`, public HTTPS `BASE_URL`, persistent `SESSION_SECRET` and readable `SSL_KEY_PATH`/`SSL_CERT_PATH`. Auth0 credentials remain in SSM. Supply `SNS_TOPIC_ARN` only when used.
- **FR-008**: Provide `terraform/scripts/bootstrap-ec2.sh` with separate `install`, `deploy` and `https` phases. Installation must not depend on DNS propagation, repository credentials or public certificate issuance.
- **FR-009**: Install root and frontend lockfiles sequentially with `npm ci --include=dev`. Run `npm run start` under systemd as `secret-santa`, never root. Stage a reviewed release separately; no repository credentials in user data/state.
- **FR-010**: Nginx terminates public ACME TLS and preserves the existing frontend HTTPS and `/api` proxy, cookies, hostname and WebSocket upgrades. Automate renewal; never expose the internal self-signed certificate to browsers.
- **FR-011**: Register the exact public Auth0 callback/origin/logout URLs. Set the emailer invitation URL to the public origin plus `/api` through existing Terraform configuration.
- **FR-012**: Add 2 GiB swap, preserve sessions/certificates on reruns, use journald, fail deployments on failed health checks and document rollback/reboot checks. Monitor CPU credits, disk and memory; no free-tier/throughput guarantee.
- **FR-013**: Validate frontend/backend tests and builds on pull requests and pushes to `main`. After a merge produces a push to `main`, package the exact commit and deploy it to EC2 using GitHub Actions OIDC, encrypted private S3 artifacts and SSM Run Command, without SSH/static AWS keys. Restrict deployment to the `production` environment/main branch, serialize releases, verify archive integrity, wait for the remote result and check public HTTPS health.
- **FR-014**: Preserve the previous release and automatically restore it if dependency installation or internal health checks fail. Fail the workflow even if restoration succeeds. External HTTPS-check failures must fail the workflow but do not automatically roll back an internally healthy release; inspect DNS/TLS before changing code.

## Edge Cases

- DNS is not ready: install/deploy work internally; public certificate issuance is separate.
- Existing CNAME/AAAA points elsewhere: inspect and migrate explicitly before HTTPS acceptance.
- IAM/SSM is missing: backend startup and deploy health checks fail; inspect journald instead of adding credential fallbacks.
- Low memory: install sequentially with swap; monitor disk/credits rather than silently changing instance size.
- Failed release: restore the previous reviewed release and rerun `deploy`; single-instance downtime is accepted.

## Success Criteria

- **SC-001**: A fresh target instance runs both applications without undocumented tool installation.
- **SC-002**: DNS, browser-trusted HTTPS, `/api/health`, Auth0 login/logout and a DynamoDB-backed party workflow pass deployment smoke tests.
- **SC-003**: The same checks pass after reboot; installer reruns preserve the session secret and public TLS configuration.
- **SC-004**: Public 22/3000/8080 access and instance-profile access to unrelated DynamoDB tables are denied.

## Assumptions

The existing hosted zone, public subnet, region-specific DynamoDB tables, Auth0 tenant and SSM parameters are available. Operators supply their IDs, a reviewed release and an ACME contact email at deployment time. These are environment inputs, not unresolved design decisions. This planning run does not create, import or modify live AWS resources.