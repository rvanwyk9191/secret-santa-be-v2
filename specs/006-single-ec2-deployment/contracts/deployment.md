# Deployment Contract

## Infrastructure Inputs For Implementation

These are Terraform inputs for the implemented deployment resources.

| Input | Contract |
|-------|----------|
| aws_region/environment | Reuse existing inputs; region matches DynamoDB/SSM resources |
| vpc_id/public_subnet_id | Existing VPC/subnet with Internet Gateway route and internet egress |
| ec2_ami_id | Reviewed Canonical Ubuntu 24.04 LTS amd64 image in the chosen region; verify SSM agent |
| instance_type | Fixed/validated `t3.micro`; exactly one instance |
| root_volume_size | Default 16 GiB; gp3; encrypted |
| public_hostname | `secretsanta.reinhardtvanwyk.com` |
| manage_dns | Default false; manual DNS remains externally owned |
| route53_zone_id | Existing public zone; required only when optional DNS ownership is enabled; import the existing A record first |
| auth0_kms_key_arn | Optional; only the customer-managed key that encrypts the Auth0 secret |
| sns_topic_arn | Optional existing notification topic; scope Publish to that topic |

Outputs: `instance_id`, `elastic_ip`, `application_url=https://secretsanta.reinhardtvanwyk.com`. Treat an existing manual record as externally managed until explicit import into the future Terraform record resource. Do not use blind overwrite. Do not import/recreate databases as part of this feature.

## Instance Profile

- Trust principal: `ec2.amazonaws.com`, action `sts:AssumeRole`.
- DynamoDB actions: `GetItem`, `PutItem`, `UpdateItem`, `DeleteItem`, `Query`, `Scan`, restricted to the existing `Parties`, `PartyMembers`, `Invitations`, `Assignments`, `NotificationEvents` table ARNs. Scope Query/Scan index resources to required indexes, especially `PartyMembers/index/party_id-index`; no account-wide table wildcard.
- SSM: `ssm:GetParameter` on the exact four `/secret-santa/auth0/{domain,audience,client_id,client_secret}` parameter ARNs in the selected region/account.
- KMS: only if a customer-managed key is used, allow `kms:Decrypt` for that key with SSM service/encryption-context constraints; retain any necessary key-policy grant.
- SNS: `sns:Publish` only to `sns_topic_arn` when configured. No emailer Lambda/S3 permissions are needed by the app merely because email is sent asynchronously.
- Administration: SSM managed-instance permissions, commonly `AmazonSSMManagedInstanceCore`. Verify the installed agent registers through regional SSM endpoints.
- Delivery: `s3:GetObject` only on the release bucket's `releases/*` prefix. The release transport uses SSE-S3; add scoped KMS permissions only if deliberately changing the bucket to a customer-managed key. This is separate from application emailer access.
- No static access-key environment variables, credential files, embedded Git tokens or root AWS credentials. Instance-profile credentials flow through the existing SDK default provider chain and IMDSv2.

Network: inbound public TCP 80/443 only; no public 22/3000/8080. Permit HTTPS egress to regional AWS APIs, Auth0, Node/package repositories and ACME; allow DNS and Ubuntu package repository access required by bootstrap. Public subnet route/Elastic IP provide connectivity without NAT. Do not advertise a DynamoDB connection as verified from IAM policy inspection alone.

## Bootstrap Interface

Run the delivered script with Bash as root **on the target Ubuntu instance only**:

| Phase | Inputs | Effects And Success |
|-------|--------|---------------------|
| `install` (default) | Optional `AWS_REGION`, default `us-east-1` | Installs OS tools and Node 25.8.2, adds swap, service user, internal TLS, persistent app env, systemd unit and Nginx ACME/redirect site; no code download or DNS prerequisite |
| `deploy` | Complete reviewed release at `/opt/secret-santa`, existing config, working instance profile and egress | Stops old service; installs both lockfiles sequentially with dev deps; enables/restarts npm start; retries TLS frontend/API health; nonzero exit on failure |
| `https` | `CERTBOT_EMAIL`; DNS A points to EIP; public port 80 reaches this instance | Obtains/retains ACME certificate, enables Nginx TLS proxy/WebSockets, configures renewal reload hook and validates Nginx configuration |
| `--help` | None | Prints usage without privileged operations |

Unknown phases return exit code 2 before privileged operations. Script errors return nonzero. Run install before deploy/https. Install preserves existing `/etc/secret-santa/app.env` and public Nginx site. It does not silently rotate a session secret or deploy a remote branch.

Install also provisions unzip/AWS CLI v2 from the official HTTPS distribution for instance-role S3 downloads. Bootstrap is an initial infrastructure step, not rerun by each application deployment.

## GitHub Actions Delivery

Workflow: `.github/workflows/deploy-ec2.yml`. Pull requests to main validate only; pushes to main validate, package and deploy; manual dispatch deploys only when the selected ref is main. Direct pushes to main also trigger this flow, so require PR merges through GitHub branch protection if merges must be the exclusive route.

Terraform creates a dedicated production deployment role with OIDC trust for the configured `github_repository`, audience `sts.amazonaws.com`, and exact subject `repo:OWNER/REPOSITORY:environment:production`. The account-level `token.actions.githubusercontent.com` provider must already exist. Restrict the GitHub `production` environment to the `main` branch; the environment subject alone does not encode a branch. No AWS access-key secrets or SSH keys are needed.

Production environment variables: `AWS_REGION`, `AWS_ROLE_ARN`, `EC2_INSTANCE_ID`, `DEPLOY_BUCKET`. Set them from Terraform outputs; region must match the instance/bucket/resources. Terraform creates a dedicated role with `s3:PutObject` on only the artifact prefix, `ssm:SendCommand` on the single target instance and the regional AWS-managed `AWS-RunShellScript` document ARN, plus `ssm:GetCommandInvocation` for completion (this API uses resource `*`). The account's GitHub OIDC provider must already exist. Restrict the GitHub `production` environment to `main`; the role trust subject is the configured exact repository/environment.

Artifact bucket: private with all public-access blocks enabled, default SSE-S3 encryption, TLS-only bucket policy and a retention lifecycle appropriate to rollback needs. Keys are immutable per SHA/run/attempt; no broad delete/list permission is needed by the workflow. Retained GitHub artifacts expire after seven days; configure S3 lifecycle separately.

Remote command verifies SHA-256, extracts into a temporary root-only directory and invokes `terraform/scripts/deploy-release.sh STAGED_DIRECTORY COMMIT_SHA`. The helper checks required files/REVISION, holds `/var/lock/secret-santa-deploy.lock`, stages a complete new checkout, stops the service and retains `/opt/secret-santa.previous`. It calls the existing bootstrap `deploy` phase. On installation/internal-health failure it restores the prior checkout (including node_modules) and attempts a restart, while returning failure. On a first-release failure there is no prior working service to restore. Failed code is retained under `/opt/secret-santa.failed`; manage disk retention on the small host. `/etc/secret-santa` is never replaced.

The workflow waits for SSM completion, prints its result and checks public frontend/API HTTPS. A public-check failure does not roll back an internally healthy release automatically. SSM execution timeout is 30 minutes and the GitHub deploy job has a 45-minute limit; credential/session duration must cover the workflow. Serialization uses main-ref workflow concurrency with no cancellation of an active deployment, plus the host lock; GitHub may supersede queued runs with newer commits.

## Runtime Interface

| Path Or Setting | Contract |
|-----------------|----------|
| `/opt/secret-santa` | Complete reviewed checkout/artifact, owned by `secret-santa`; no bundled node_modules |
| `/etc/secret-santa/app.env` | Root-owned, mode 0640, service-group readable; systemd loads it |
| `AWS_REGION` | Same region as existing tables and Auth0 parameters |
| `BASE_URL` | `https://secretsanta.reinhardtvanwyk.com`, no private backend port |
| `SESSION_SECRET` | Persistent random 32-byte value, generated on instance; never in Terraform state/user data/logs |
| `SSL_KEY_PATH`, `SSL_CERT_PATH` | Protected local TLS files under `/etc/secret-santa`, covering localhost/127.0.0.1 |
| `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS` | Exact public hostname; never blanket host allowance |
| `SNS_TOPIC_ARN` | Optional configured topic; if set, IAM must permit it |
| `secret-santa.service` | Unprivileged repository-root `/usr/local/bin/npm run start`; both applications restart together; logs in journald |

The public proxy preserves Host/cookies and supports WebSocket upgrades without exposing port 3000. Existing Vite `/api` routing and frontend same-origin API calls remain unchanged. Internal TLS is separate from the public certificate. Certificate renewal reloads Nginx; it does not restart Node, which uses its separate local certificate. Re-run install after deliberate local-certificate replacement and restart the app/reload Nginx; rotate before the local certificate expires.

## Public Acceptance Interface

- `GET https://secretsanta.reinhardtvanwyk.com/`: HTTP 200 frontend HTML.
- `GET /api/health`: HTTP 200 JSON `{"status":"ok"}`; successful health is not proof of DynamoDB permissions.
- Auth0 callback: `https://secretsanta.reinhardtvanwyk.com/api/auth/callback`; allowed web origin/logout URL: `https://secretsanta.reinhardtvanwyk.com`. Verify login/logout with Secure HttpOnly cookies and no Bearer-token fallback.
- Emailer Terraform input: `invitation_base_url=https://secretsanta.reinhardtvanwyk.com/api`.
- Persistence acceptance: authenticated create/read and assignment/member-index flow succeeds; access to an unrelated table is denied.
- Lifecycle acceptance: installer rerun preserves secret/TLS; reboot recovers both servers; `certbot renew --dry-run` passes; external checks confirm closed 22/3000/8080.